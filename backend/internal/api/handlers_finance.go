package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

// ----------------------------------------------------------------------------
// Phase 5: Debt Management (Receivables & Payables)
// ----------------------------------------------------------------------------

type DebtPartnerItem struct {
	ID                 string          `json:"id"`
	Name               string          `json:"name"`
	Phone              *string         `json:"phone,omitempty"`
	Address            *string         `json:"address,omitempty"`
	PartnerType        model.PartnerType `json:"partner_type"`
	CurrentDebtBalance decimal.Decimal `json:"current_debt_balance"`
	CreditLimit        decimal.Decimal `json:"credit_limit"`
	RecentLedgerCount  int             `json:"recent_ledger_count"`
	LastTransactionAt  *time.Time      `json:"last_transaction_at,omitempty"`
}

func (s *Server) handleGetDebts(w http.ResponseWriter, r *http.Request) {
	partnerType := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("type")))
	onlyDebt := r.URL.Query().Get("only_debt") == "true"
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	query := s.db.Model(&model.Partner{}).Where("is_active = ?", true)

	if partnerType != "" {
		query = query.Where("partner_type = ? OR partner_type = ?", partnerType, model.PartnerTypeBoth)
	}

	if onlyDebt {
		query = query.Where("current_debt_balance > 0")
	}

	if q != "" {
		like := "%" + q + "%"
		query = query.Where("name LIKE ? OR phone LIKE ?", like, like)
	}

	var partners []model.Partner
	if err := query.Order("current_debt_balance desc, name asc").Find(&partners).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	result := make([]DebtPartnerItem, 0, len(partners))
	for _, p := range partners {
		var lastLedger model.DebtLedger
		var lastTime *time.Time
		if err := s.db.Where("partner_id = ?", p.ID).Order("created_at desc").First(&lastLedger).Error; err == nil {
			lastTime = &lastLedger.CreatedAt
		}

		var count int64
		s.db.Model(&model.DebtLedger{}).Where("partner_id = ?", p.ID).Count(&count)

		result = append(result, DebtPartnerItem{
			ID:                 p.ID,
			Name:               p.Name,
			Phone:              p.Phone,
			Address:            p.Address,
			PartnerType:        p.PartnerType,
			CurrentDebtBalance: p.CurrentDebtBalance,
			CreditLimit:        p.CreditLimit,
			RecentLedgerCount:  int(count),
			LastTransactionAt:  lastTime,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

type RecordDebtPaymentDTO struct {
	PartnerID     string                      `json:"partner_id"`
	Amount        decimal.Decimal             `json:"amount"`
	PaymentMethod model.CashbookPaymentMethod `json:"payment_method"`
	Note          string                      `json:"note"`
	ReferenceID   *string                     `json:"reference_id,omitempty"`
}

func (s *Server) handleRecordDebtPayment(w http.ResponseWriter, r *http.Request) {
	var input RecordDebtPaymentDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if input.PartnerID == "" {
		writeError(w, http.StatusBadRequest, "partner_id is required")
		return
	}

	if input.Amount.LessThanOrEqual(decimal.Zero) {
		writeError(w, http.StatusBadRequest, "số tiền thanh toán nợ phải lớn hơn 0")
		return
	}

	if input.PaymentMethod == "" {
		input.PaymentMethod = model.CashbookPaymentMethodCash
	}

	ref := input.ReferenceID
	if ref == nil || *ref == "" {
		gen := fmt.Sprintf("PAY-%s-%04d", time.Now().Format("060102"), time.Now().Unix()%10000)
		ref = &gen
	}

	var partner model.Partner
	var debtEntry model.DebtLedger
	var cashTx model.CashbookTransaction

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&partner, "id = ?", input.PartnerID).Error; err != nil {
			return fmt.Errorf("không tìm thấy đối tác: %w", err)
		}

		newBalance := partner.CurrentDebtBalance.Sub(input.Amount)

		note := input.Note
		if note == "" {
			if partner.PartnerType == model.PartnerTypeCustomer {
				note = fmt.Sprintf("Thu tiền nợ khách hàng %s", partner.Name)
			} else {
				note = fmt.Sprintf("Chi tiền trả nợ nhà cung cấp %s", partner.Name)
			}
		}

		// 1. Record Debt Ledger
		debtTxType := model.DebtTransactionTypeDebtRepayment
		if partner.PartnerType == model.PartnerTypeSupplier {
			debtTxType = model.DebtTransactionTypeSupplierPayment
		}

		debtEntry = model.DebtLedger{
			ID:              uuid.New().String(),
			PartnerID:       partner.ID,
			TransactionType: debtTxType,
			ReferenceID:     ref,
			Amount:          input.Amount,
			BalanceAfter:    newBalance,
			Note:            &note,
			CreatedAt:       time.Now(),
		}
		if err := tx.Create(&debtEntry).Error; err != nil {
			return err
		}

		// 2. Update Partner CurrentDebtBalance
		if err := tx.Model(&partner).Update("current_debt_balance", newBalance).Error; err != nil {
			return err
		}

		// 3. Record Cashbook Entry
		if partner.PartnerType == model.PartnerTypeSupplier {
			// Paying supplier -> Cashbook OUTFLOW
			cashTx = model.CashbookTransaction{
				ID:              uuid.New().String(),
				TransactionType: model.CashbookTypeOutflow,
				Category:        model.CashbookCategorySupplierPayment,
				Amount:          input.Amount,
				PaymentMethod:   input.PaymentMethod,
				PartnerID:       &partner.ID,
				Description:     note,
				CreatedAt:       time.Now(),
			}
		} else {
			// Collecting from customer -> Cashbook INFLOW
			cashTx = model.CashbookTransaction{
				ID:              uuid.New().String(),
				TransactionType: model.CashbookTypeInflow,
				Category:        model.CashbookCategoryDebtCollection,
				Amount:          input.Amount,
				PaymentMethod:   input.PaymentMethod,
				PartnerID:       &partner.ID,
				Description:     note,
				CreatedAt:       time.Now(),
			}
		}

		return tx.Create(&cashTx).Error
	})

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"partner_id":           partner.ID,
		"partner_name":         partner.Name,
		"amount_paid":          input.Amount,
		"new_debt_balance":     partner.CurrentDebtBalance.Sub(input.Amount),
		"debt_entry":           debtEntry,
		"cashbook_transaction": cashTx,
	})
}

func (s *Server) handleGetPartnerDebtHistory(w http.ResponseWriter, r *http.Request) {
	partnerID := r.PathValue("id")
	if partnerID == "" {
		writeError(w, http.StatusBadRequest, "partner id is required")
		return
	}

	var entries []model.DebtLedger
	if err := s.db.Where("partner_id = ?", partnerID).Order("created_at desc").Find(&entries).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, entries)
}

// ----------------------------------------------------------------------------
// Phase 5: Cashbook (Sổ quỹ Thu / Chi)
// ----------------------------------------------------------------------------

func (s *Server) handleGetCashbook(w http.ResponseWriter, r *http.Request) {
	txType := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("type")))
	category := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("category")))
	method := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("payment_method")))
	fromDate := strings.TrimSpace(r.URL.Query().Get("from"))
	toDate := strings.TrimSpace(r.URL.Query().Get("to"))

	query := s.db.Model(&model.CashbookTransaction{}).Preload("Partner")

	if txType != "" {
		query = query.Where("transaction_type = ?", txType)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if method != "" {
		query = query.Where("payment_method = ?", method)
	}
	if fromDate != "" {
		query = query.Where("created_at >= ?", fromDate+" 00:00:00")
	}
	if toDate != "" {
		query = query.Where("created_at <= ?", toDate+" 23:59:59")
	}

	var entries []model.CashbookTransaction
	if err := query.Order("created_at desc").Find(&entries).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, entries)
}

type CreateCashbookTransactionDTO struct {
	TransactionType model.CashbookType          `json:"transaction_type"`
	Category        model.CashbookCategory      `json:"category"`
	Amount          decimal.Decimal             `json:"amount"`
	PaymentMethod   model.CashbookPaymentMethod `json:"payment_method"`
	PartnerID       *string                     `json:"partner_id,omitempty"`
	Description     string                      `json:"description"`
}

func (s *Server) handleCreateCashbookTransaction(w http.ResponseWriter, r *http.Request) {
	var input CreateCashbookTransactionDTO
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if input.Amount.LessThanOrEqual(decimal.Zero) {
		writeError(w, http.StatusBadRequest, "số tiền phải lớn hơn 0")
		return
	}

	if strings.TrimSpace(input.Description) == "" {
		writeError(w, http.StatusBadRequest, "mô tả lý do thu/chi không được để trống")
		return
	}

	if input.PaymentMethod == "" {
		input.PaymentMethod = model.CashbookPaymentMethodCash
	}

	tx := model.CashbookTransaction{
		ID:              uuid.New().String(),
		TransactionType: input.TransactionType,
		Category:        input.Category,
		Amount:          input.Amount,
		PaymentMethod:   input.PaymentMethod,
		PartnerID:       input.PartnerID,
		Description:     strings.TrimSpace(input.Description),
		CreatedAt:       time.Now(),
	}

	if err := s.db.Create(&tx).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, tx)
}

type CashbookSummaryResponse struct {
	TotalInflow  decimal.Decimal `json:"total_inflow"`
	TotalOutflow decimal.Decimal `json:"total_outflow"`
	NetBalance   decimal.Decimal `json:"net_balance"`
	CashInflow   decimal.Decimal `json:"cash_inflow"`
	CashOutflow  decimal.Decimal `json:"cash_outflow"`
	CashBalance  decimal.Decimal `json:"cash_balance"`
	BankInflow   decimal.Decimal `json:"bank_inflow"`
	BankOutflow  decimal.Decimal `json:"bank_outflow"`
	BankBalance  decimal.Decimal `json:"bank_balance"`
}

func (s *Server) handleGetCashbookSummary(w http.ResponseWriter, r *http.Request) {
	var entries []model.CashbookTransaction
	if err := s.db.Find(&entries).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var res CashbookSummaryResponse
	for _, it := range entries {
		isCash := it.PaymentMethod == model.CashbookPaymentMethodCash

		if it.TransactionType == model.CashbookTypeInflow {
			res.TotalInflow = res.TotalInflow.Add(it.Amount)
			if isCash {
				res.CashInflow = res.CashInflow.Add(it.Amount)
			} else {
				res.BankInflow = res.BankInflow.Add(it.Amount)
			}
		} else if it.TransactionType == model.CashbookTypeOutflow {
			res.TotalOutflow = res.TotalOutflow.Add(it.Amount)
			if isCash {
				res.CashOutflow = res.CashOutflow.Add(it.Amount)
			} else {
				res.BankOutflow = res.BankOutflow.Add(it.Amount)
			}
		}
	}

	res.NetBalance = res.TotalInflow.Sub(res.TotalOutflow)
	res.CashBalance = res.CashInflow.Sub(res.CashOutflow)
	res.BankBalance = res.BankInflow.Sub(res.BankOutflow)

	writeJSON(w, http.StatusOK, res)
}

// ----------------------------------------------------------------------------
// Phase 5: P&L Report (Báo cáo Lãi / Lỗ thực tế)
// ----------------------------------------------------------------------------

type PnLDayStat struct {
	Date         string          `json:"date"`
	Revenue      decimal.Decimal `json:"revenue"`
	COGS         decimal.Decimal `json:"cogs"`
	GrossProfit  decimal.Decimal `json:"gross_profit"`
	WastageLoss  decimal.Decimal `json:"wastage_loss"`
	OperatingExp decimal.Decimal `json:"operating_exp"`
	NetProfit    decimal.Decimal `json:"net_profit"`
}

type PnLReportResponse struct {
	FromDate           string          `json:"from_date"`
	ToDate             string          `json:"to_date"`
	TotalRevenue       decimal.Decimal `json:"total_revenue"`
	TotalCOGS          decimal.Decimal `json:"total_cogs"`
	GrossProfit        decimal.Decimal `json:"gross_profit"`
	GrossMarginPercent decimal.Decimal `json:"gross_margin_percent"`
	TotalWastageLoss   decimal.Decimal `json:"total_wastage_loss"`
	TotalOperatingExp  decimal.Decimal `json:"total_operating_exp"`
	NetProfit          decimal.Decimal `json:"net_profit"`
	NetMarginPercent   decimal.Decimal `json:"net_margin_percent"`
	ExpensesByCategory map[string]decimal.Decimal `json:"expenses_by_category"`
	DailyBreakdown     []PnLDayStat    `json:"daily_breakdown"`
}

func (s *Server) handleGetPnLReport(w http.ResponseWriter, r *http.Request) {
	fromDateStr := strings.TrimSpace(r.URL.Query().Get("from"))
	toDateStr := strings.TrimSpace(r.URL.Query().Get("to"))

	now := time.Now()
	if fromDateStr == "" {
		fromDateStr = now.AddDate(0, 0, -30).Format("2006-01-02")
	}
	if toDateStr == "" {
		toDateStr = now.Format("2006-01-02")
	}

	fromTime, _ := time.Parse("2006-01-02", fromDateStr)
	toTime, _ := time.Parse("2006-01-02", toDateStr)
	toTimeEnd := toTime.Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	// 1. Completed Sales Orders
	var orders []model.SalesOrder
	_ = s.db.Where("status = ? AND created_at >= ? AND created_at <= ?", model.OrderStatusCompleted, fromTime, toTimeEnd).Find(&orders)

	var totalRevenue decimal.Decimal
	var totalCOGS decimal.Decimal
	dayMap := make(map[string]*PnLDayStat)

	for _, o := range orders {
		totalRevenue = totalRevenue.Add(o.TotalAmount)
		totalCOGS = totalCOGS.Add(o.TotalCogs)

		dayKey := o.CreatedAt.Format("2006-01-02")
		if _, ok := dayMap[dayKey]; !ok {
			dayMap[dayKey] = &PnLDayStat{Date: dayKey}
		}
		dayMap[dayKey].Revenue = dayMap[dayKey].Revenue.Add(o.TotalAmount)
		dayMap[dayKey].COGS = dayMap[dayKey].COGS.Add(o.TotalCogs)
	}

	grossProfit := totalRevenue.Sub(totalCOGS)
	grossMargin := decimal.Zero
	if totalRevenue.GreaterThan(decimal.Zero) {
		grossMargin = grossProfit.Div(totalRevenue).Mul(decimal.NewFromInt(100)).Round(2)
	}

	// 2. Wastage & Spoilage loss
	var wastageMovements []model.InventoryMovement
	_ = s.db.Where("movement_type = ? AND created_at >= ? AND created_at <= ?", model.MovementTypeWastageSpoilage, fromTime, toTimeEnd).Find(&wastageMovements)

	var totalWastageLoss decimal.Decimal
	for _, m := range wastageMovements {
		lossVal := m.QtyInBaseUom.Abs().Mul(m.UnitCostAtTime)
		totalWastageLoss = totalWastageLoss.Add(lossVal)

		dayKey := m.CreatedAt.Format("2006-01-02")
		if _, ok := dayMap[dayKey]; !ok {
			dayMap[dayKey] = &PnLDayStat{Date: dayKey}
		}
		dayMap[dayKey].WastageLoss = dayMap[dayKey].WastageLoss.Add(lossVal)
	}

	// 3. Operating Expenses from Cashbook
	var expenseTransactions []model.CashbookTransaction
	_ = s.db.Where("transaction_type = ? AND category IN (?) AND created_at >= ? AND created_at <= ?",
		model.CashbookTypeOutflow,
		[]model.CashbookCategory{
			model.CashbookCategoryRent,
			model.CashbookCategoryElectricity,
			model.CashbookCategoryIcePackaging,
			model.CashbookCategoryStaffWage,
			model.CashbookCategoryShipping,
			model.CashbookCategoryOtherExpense,
		},
		fromTime, toTimeEnd,
	).Find(&expenseTransactions)

	var totalOperatingExp decimal.Decimal
	expByCat := make(map[string]decimal.Decimal)

	for _, tx := range expenseTransactions {
		totalOperatingExp = totalOperatingExp.Add(tx.Amount)
		catStr := string(tx.Category)
		expByCat[catStr] = expByCat[catStr].Add(tx.Amount)

		dayKey := tx.CreatedAt.Format("2006-01-02")
		if _, ok := dayMap[dayKey]; !ok {
			dayMap[dayKey] = &PnLDayStat{Date: dayKey}
		}
		dayMap[dayKey].OperatingExp = dayMap[dayKey].OperatingExp.Add(tx.Amount)
	}

	netProfit := grossProfit.Sub(totalWastageLoss).Sub(totalOperatingExp)
	netMargin := decimal.Zero
	if totalRevenue.GreaterThan(decimal.Zero) {
		netMargin = netProfit.Div(totalRevenue).Mul(decimal.NewFromInt(100)).Round(2)
	}

	dailyList := make([]PnLDayStat, 0, len(dayMap))
	for _, stat := range dayMap {
		stat.GrossProfit = stat.Revenue.Sub(stat.COGS)
		stat.NetProfit = stat.GrossProfit.Sub(stat.WastageLoss).Sub(stat.OperatingExp)
		dailyList = append(dailyList, *stat)
	}

	res := PnLReportResponse{
		FromDate:           fromDateStr,
		ToDate:             toDateStr,
		TotalRevenue:       totalRevenue,
		TotalCOGS:          totalCOGS,
		GrossProfit:        grossProfit,
		GrossMarginPercent: grossMargin,
		TotalWastageLoss:   totalWastageLoss,
		TotalOperatingExp:  totalOperatingExp,
		NetProfit:          netProfit,
		NetMarginPercent:   netMargin,
		ExpensesByCategory: expByCat,
		DailyBreakdown:     dailyList,
	}

	writeJSON(w, http.StatusOK, res)
}
