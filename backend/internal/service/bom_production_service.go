package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

type AssemblyParams struct {
	RecipeID        string
	TargetOutputQty decimal.Decimal
	BatchCode       *string
	OtherCost       decimal.Decimal
	ExpiryDate      *time.Time
	SupplierID      *string
	Notes           *string
}

type DisassemblyYieldOutput struct {
	ComponentVariantID string
	ActualQty          decimal.Decimal
	BatchCode          *string
	ExpiryDate         *time.Time
}

type DisassemblyParams struct {
	RecipeID     string
	InputQty     decimal.Decimal
	YieldOutputs []DisassemblyYieldOutput
	BatchCode    *string
	OtherCost    decimal.Decimal
	Notes        *string
}

type BackflushItem struct {
	VariantID     string
	Qty           decimal.Decimal
	ModifiersJSON string
	ReferenceID   *string
}

type BackflushParams struct {
	Items []BackflushItem
}

type WastageParams struct {
	VariantID        string
	BatchID          *string
	LostQty          decimal.Decimal
	InputUOM         string
	ReasonNote       string
	RecordToCashbook bool
	ReferenceID      *string
}

type BOMProductionService struct {
	db            *gorm.DB
	ledgerService *InventoryLedgerService
}

func NewBOMProductionService(db *gorm.DB, ledgerService *InventoryLedgerService) *BOMProductionService {
	if ledgerService == nil {
		ledgerService = NewInventoryLedgerService(db)
	}
	return &BOMProductionService{
		db:            db,
		ledgerService: ledgerService,
	}
}

// ExecuteAssembly manufactures finished goods from N raw materials.
// Deducts raw materials, creates batch if specified, updates WAC, records movements and production order.
// ponytail: standard assembly assumes single-output recipe; upgrade to multi-output co-product assembly if needed.
func (s *BOMProductionService) ExecuteAssembly(ctx context.Context, tx *gorm.DB, params AssemblyParams) (*model.ProductionOrder, error) {
	if tx == nil {
		var order *model.ProductionOrder
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			order, err = s.ExecuteAssembly(ctx, innerTx, params)
			return err
		})
		return order, err
	}

	db := tx.WithContext(ctx)

	if params.TargetOutputQty.LessThanOrEqual(decimal.Zero) {
		return nil, ErrInvalidYieldQty
	}

	var recipe model.BomRecipe
	if err := db.Preload("Items.ComponentVariant.Product").Preload("TargetVariant.Product").First(&recipe, "id = ?", params.RecipeID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRecipeNotFound
		}
		return nil, err
	}

	ratio := decimal.NewFromInt(1)
	if !recipe.OutputQty.IsZero() {
		ratio = params.TargetOutputQty.Div(recipe.OutputQty)
	} else {
		ratio = params.TargetOutputQty
	}

	orderID := uuid.New().String()
	totalMaterialCost := decimal.Zero
	totalInputQty := decimal.Zero

	for _, item := range recipe.Items {
		compQty := item.QtyRequired.Mul(ratio)
		totalInputQty = totalInputQty.Add(compQty)

		var compVariant model.ProductVariant
		if item.ComponentVariant != nil {
			compVariant = *item.ComponentVariant
		} else {
			if err := db.Preload("Product").First(&compVariant, "id = ?", item.ComponentVariantID).Error; err != nil {
				return nil, err
			}
		}

		compCost := compQty.Mul(compVariant.CostPrice)
		totalMaterialCost = totalMaterialCost.Add(compCost)

		inputUom := ""
		if compVariant.Product != nil {
			inputUom = compVariant.Product.BaseUom
		}

		note := fmt.Sprintf("Assembly consume for production order %s", orderID)
		if _, err := s.ledgerService.RecordMovement(ctx, db, RecordMovementParams{
			VariantID:      item.ComponentVariantID,
			MovementType:   model.MovementTypeProductionConsume,
			QtyInBaseUom:   compQty.Neg(),
			InputUOM:       inputUom,
			InputQty:       compQty.Neg(),
			UnitCostAtTime: compVariant.CostPrice,
			ReferenceID:    &orderID,
			ReasonNote:     &note,
		}); err != nil {
			return nil, err
		}
	}

	totalProductionCost := totalMaterialCost.Add(params.OtherCost)
	costPerUnit := totalProductionCost.Div(params.TargetOutputQty)

	var batchID *string
	if params.BatchCode != nil && *params.BatchCode != "" {
		batch := &model.InventoryBatch{
			ID:           uuid.New().String(),
			VariantID:    recipe.TargetVariantID,
			BatchCode:    *params.BatchCode,
			SupplierID:   params.SupplierID,
			ReceivedDate: time.Now(),
			ExpiryDate:   params.ExpiryDate,
			InitialQty:   params.TargetOutputQty,
			RemainingQty: decimal.Zero,
			UnitCost:     costPerUnit,
		}
		if err := db.Create(batch).Error; err != nil {
			return nil, err
		}
		batchID = &batch.ID
	}

	if _, err := s.ledgerService.CalculateNewWAC(ctx, db, recipe.TargetVariantID, params.TargetOutputQty, costPerUnit); err != nil {
		return nil, err
	}

	targetUom := ""
	if recipe.TargetVariant != nil && recipe.TargetVariant.Product != nil {
		targetUom = recipe.TargetVariant.Product.BaseUom
	}

	yieldNote := fmt.Sprintf("Assembly yield for production order %s", orderID)
	if _, err := s.ledgerService.RecordMovement(ctx, db, RecordMovementParams{
		VariantID:      recipe.TargetVariantID,
		BatchID:        batchID,
		MovementType:   model.MovementTypeProductionYield,
		QtyInBaseUom:   params.TargetOutputQty,
		InputUOM:       targetUom,
		InputQty:       params.TargetOutputQty,
		UnitCostAtTime: costPerUnit,
		ReferenceID:    &orderID,
		ReasonNote:     &yieldNote,
	}); err != nil {
		return nil, err
	}

	order := &model.ProductionOrder{
		ID:                orderID,
		RecipeID:          recipe.ID,
		BatchCode:         params.BatchCode,
		Status:            model.ProductionStatusCompleted,
		InputQty:          totalInputQty,
		ActualYieldQty:    params.TargetOutputQty,
		TotalMaterialCost: totalMaterialCost,
		OtherCost:         params.OtherCost,
		Notes:             params.Notes,
	}

	if err := db.Create(order).Error; err != nil {
		return nil, err
	}

	return order, nil
}

// ExecuteDisassembly breaks down 1 raw material into multiple yield components with cost allocation percent.
// ponytail: cost allocated by explicit percent; upgrade to dynamic market-value relative allocation if needed.
func (s *BOMProductionService) ExecuteDisassembly(ctx context.Context, tx *gorm.DB, params DisassemblyParams) (*model.ProductionOrder, error) {
	if tx == nil {
		var order *model.ProductionOrder
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			order, err = s.ExecuteDisassembly(ctx, innerTx, params)
			return err
		})
		return order, err
	}

	db := tx.WithContext(ctx)

	if params.InputQty.LessThanOrEqual(decimal.Zero) {
		return nil, ErrInvalidInputQty
	}

	var recipe model.BomRecipe
	if err := db.Preload("Items.ComponentVariant.Product").Preload("TargetVariant.Product").First(&recipe, "id = ?", params.RecipeID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRecipeNotFound
		}
		return nil, err
	}

	var rawVariant model.ProductVariant
	if recipe.TargetVariant != nil {
		rawVariant = *recipe.TargetVariant
	} else {
		if err := db.Preload("Product").First(&rawVariant, "id = ?", recipe.TargetVariantID).Error; err != nil {
			return nil, err
		}
	}

	orderID := uuid.New().String()
	totalMaterialCost := params.InputQty.Mul(rawVariant.CostPrice)
	totalDisasmCost := totalMaterialCost.Add(params.OtherCost)

	rawUom := ""
	if rawVariant.Product != nil {
		rawUom = rawVariant.Product.BaseUom
	}

	consumeNote := fmt.Sprintf("Disassembly consume for order %s", orderID)
	if _, err := s.ledgerService.RecordMovement(ctx, db, RecordMovementParams{
		VariantID:      recipe.TargetVariantID,
		MovementType:   model.MovementTypeProductionConsume,
		QtyInBaseUom:   params.InputQty.Neg(),
		InputUOM:       rawUom,
		InputQty:       params.InputQty.Neg(),
		UnitCostAtTime: rawVariant.CostPrice,
		ReferenceID:    &orderID,
		ReasonNote:     &consumeNote,
	}); err != nil {
		return nil, err
	}

	itemMap := make(map[string]model.BomItem)
	for _, it := range recipe.Items {
		itemMap[it.ComponentVariantID] = it
	}

	totalYieldQty := decimal.Zero
	hundred := decimal.NewFromInt(100)

	for _, yield := range params.YieldOutputs {
		totalYieldQty = totalYieldQty.Add(yield.ActualQty)

		item, ok := itemMap[yield.ComponentVariantID]
		allocPercent := decimal.Zero
		if ok {
			allocPercent = item.CostAllocationPercent
		}

		allocatedCost := totalDisasmCost.Mul(allocPercent).Div(hundred)
		unitCost := decimal.Zero
		if !yield.ActualQty.IsZero() {
			unitCost = allocatedCost.Div(yield.ActualQty)
		}

		var yieldVariant model.ProductVariant
		if item.ComponentVariant != nil {
			yieldVariant = *item.ComponentVariant
		} else {
			if err := db.Preload("Product").First(&yieldVariant, "id = ?", yield.ComponentVariantID).Error; err != nil {
				return nil, err
			}
		}

		yieldUom := ""
		if yieldVariant.Product != nil {
			yieldUom = yieldVariant.Product.BaseUom
		}

		var batchID *string
		bCode := yield.BatchCode
		if bCode == nil {
			bCode = params.BatchCode
		}
		if bCode != nil && *bCode != "" {
			batch := &model.InventoryBatch{
				ID:           uuid.New().String(),
				VariantID:    yield.ComponentVariantID,
				BatchCode:    *bCode,
				ReceivedDate: time.Now(),
				ExpiryDate:   yield.ExpiryDate,
				InitialQty:   yield.ActualQty,
				RemainingQty: decimal.Zero,
				UnitCost:     unitCost,
			}
			if err := db.Create(batch).Error; err != nil {
				return nil, err
			}
			batchID = &batch.ID
		}

		if _, err := s.ledgerService.CalculateNewWAC(ctx, db, yield.ComponentVariantID, yield.ActualQty, unitCost); err != nil {
			return nil, err
		}

		yieldNote := fmt.Sprintf("Disassembly yield for order %s", orderID)
		if _, err := s.ledgerService.RecordMovement(ctx, db, RecordMovementParams{
			VariantID:      yield.ComponentVariantID,
			BatchID:        batchID,
			MovementType:   model.MovementTypeProductionYield,
			QtyInBaseUom:   yield.ActualQty,
			InputUOM:       yieldUom,
			InputQty:       yield.ActualQty,
			UnitCostAtTime: unitCost,
			ReferenceID:    &orderID,
			ReasonNote:     &yieldNote,
		}); err != nil {
			return nil, err
		}
	}

	order := &model.ProductionOrder{
		ID:                orderID,
		RecipeID:          recipe.ID,
		BatchCode:         params.BatchCode,
		Status:            model.ProductionStatusCompleted,
		InputQty:          params.InputQty,
		ActualYieldQty:    totalYieldQty,
		TotalMaterialCost: totalMaterialCost,
		OtherCost:         params.OtherCost,
		Notes:             params.Notes,
	}

	if err := db.Create(order).Error; err != nil {
		return nil, err
	}

	return order, nil
}

type rawModifierEntry struct {
	ID              string          `json:"id"`
	ModifierItemID  string          `json:"modifier_item_id"`
	Name            string          `json:"name"`
	LinkedVariantID string          `json:"linked_variant_id"`
	LinkedSKU       string          `json:"linked_sku"`
	DeductQty       decimal.Decimal `json:"deduct_qty"`
	Qty             decimal.Decimal `json:"qty"`
	UOM             string          `json:"uom"`
}

// ExecuteBackflushDeduction deducts ingredients for assembled/sold items and their modifiers automatically.
// ponytail: modifiers backflushed with linear qty multiplication; upgrade to nested modifier sub-recipes if needed.
func (s *BOMProductionService) ExecuteBackflushDeduction(ctx context.Context, tx *gorm.DB, params BackflushParams) ([]*model.InventoryMovement, error) {
	if tx == nil {
		var movements []*model.InventoryMovement
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			movements, err = s.ExecuteBackflushDeduction(ctx, innerTx, params)
			return err
		})
		return movements, err
	}

	db := tx.WithContext(ctx)
	resultMovements := make([]*model.InventoryMovement, 0)

	for _, item := range params.Items {
		// 1. Process BOM Recipe for main item
		var recipe model.BomRecipe
		err := db.Preload("Items.ComponentVariant.Product").
			Where("target_variant_id = ? AND recipe_type = ?", item.VariantID, model.RecipeTypeAssembly).
			First(&recipe).Error

		if err == nil {
			ratio := item.Qty
			if !recipe.OutputQty.IsZero() {
				ratio = item.Qty.Div(recipe.OutputQty)
			}

			for _, bomItem := range recipe.Items {
				neededQty := bomItem.QtyRequired.Mul(ratio)
				uom := ""
				unitCost := decimal.Zero
				if bomItem.ComponentVariant != nil {
					unitCost = bomItem.ComponentVariant.CostPrice
					if bomItem.ComponentVariant.Product != nil {
						uom = bomItem.ComponentVariant.Product.BaseUom
					}
				}

				note := "Backflush BOM ingredient deduction"
				mov, err := s.ledgerService.RecordMovement(ctx, db, RecordMovementParams{
					VariantID:      bomItem.ComponentVariantID,
					MovementType:   model.MovementTypeProductionConsume,
					QtyInBaseUom:   neededQty.Neg(),
					InputUOM:       uom,
					InputQty:       neededQty.Neg(),
					UnitCostAtTime: unitCost,
					ReferenceID:    item.ReferenceID,
					ReasonNote:     &note,
				})
				if err != nil {
					return nil, err
				}
				resultMovements = append(resultMovements, mov)
			}
		}

		// 2. Process Modifiers
		if item.ModifiersJSON != "" {
			var modEntries []rawModifierEntry
			if err := json.Unmarshal([]byte(item.ModifiersJSON), &modEntries); err == nil {
				for _, mod := range modEntries {
					var targetVariant model.ProductVariant
					var variantFound bool

					if mod.LinkedVariantID != "" {
						if err := db.Preload("Product").First(&targetVariant, "id = ?", mod.LinkedVariantID).Error; err == nil {
							variantFound = true
						}
					} else if mod.LinkedSKU != "" {
						if err := db.Preload("Product").First(&targetVariant, "sku = ?", mod.LinkedSKU).Error; err == nil {
							variantFound = true
						}
					} else if mod.ModifierItemID != "" || mod.ID != "" {
						lookupID := mod.ModifierItemID
						if lookupID == "" {
							lookupID = mod.ID
						}
						var modItem model.ModifierItem
						if err := db.Preload("LinkedVariant.Product").First(&modItem, "id = ?", lookupID).Error; err == nil {
							if modItem.LinkedVariant != nil {
								targetVariant = *modItem.LinkedVariant
								variantFound = true
								if mod.DeductQty.IsZero() && modItem.DeductQty != nil {
									mod.DeductQty = *modItem.DeductQty
								}
							}
						}
					}

					if !variantFound {
						continue
					}

					deductQtyPerUnit := mod.DeductQty
					if deductQtyPerUnit.IsZero() {
						deductQtyPerUnit = decimal.NewFromInt(1)
					}

					modCount := mod.Qty
					if modCount.IsZero() {
						modCount = decimal.NewFromInt(1)
					}

					totalModifierDeduct := deductQtyPerUnit.Mul(item.Qty).Mul(modCount)
					if totalModifierDeduct.IsZero() {
						continue
					}

					uom := ""
					if targetVariant.Product != nil {
						uom = targetVariant.Product.BaseUom
					}

					note := fmt.Sprintf("Backflush modifier deduction: %s", mod.Name)
					mov, err := s.ledgerService.RecordMovement(ctx, db, RecordMovementParams{
						VariantID:      targetVariant.ID,
						MovementType:   model.MovementTypeProductionConsume,
						QtyInBaseUom:   totalModifierDeduct.Neg(),
						InputUOM:       uom,
						InputQty:       totalModifierDeduct.Neg(),
						UnitCostAtTime: targetVariant.CostPrice,
						ReferenceID:    item.ReferenceID,
						ReasonNote:     &note,
					})
					if err != nil {
						return nil, err
					}
					resultMovements = append(resultMovements, mov)
				}
			}
		}
	}

	return resultMovements, nil
}

// RecordWastage records stock loss due to spoilage, expiration, or damage, and optionally writes to Cashbook.
// ponytail: wastage creates cashbook expense outflow under OTHER_EXPENSE; upgrade to sub-ledger breakdown if needed.
func (s *BOMProductionService) RecordWastage(ctx context.Context, tx *gorm.DB, params WastageParams) (*model.InventoryMovement, *model.CashbookTransaction, error) {
	if tx == nil {
		var mov *model.InventoryMovement
		var cashTx *model.CashbookTransaction
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			mov, cashTx, err = s.RecordWastage(ctx, innerTx, params)
			return err
		})
		return mov, cashTx, err
	}

	db := tx.WithContext(ctx)

	lostQty := params.LostQty.Abs()
	if lostQty.IsZero() {
		return nil, nil, ErrInvalidInputQty
	}

	var variant model.ProductVariant
	if err := db.Preload("Product").First(&variant, "id = ?", params.VariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrVariantNotFound
		}
		return nil, nil, err
	}

	inputUom := params.InputUOM
	if inputUom == "" && variant.Product != nil {
		inputUom = variant.Product.BaseUom
	}

	mov, err := s.ledgerService.RecordMovement(ctx, db, RecordMovementParams{
		VariantID:      params.VariantID,
		BatchID:        params.BatchID,
		MovementType:   model.MovementTypeWastageSpoilage,
		QtyInBaseUom:   lostQty.Neg(),
		InputUOM:       inputUom,
		InputQty:       lostQty.Neg(),
		UnitCostAtTime: variant.CostPrice,
		ReferenceID:    params.ReferenceID,
		ReasonNote:     &params.ReasonNote,
	})
	if err != nil {
		return nil, nil, err
	}

	var cashTx *model.CashbookTransaction
	if params.RecordToCashbook {
		expenseAmount := lostQty.Mul(variant.CostPrice)
		desc := params.ReasonNote
		if desc == "" {
			desc = "Wastage spoilage expense"
		}

		cashTx = &model.CashbookTransaction{
			ID:              uuid.New().String(),
			TransactionType: model.CashbookTypeOutflow,
			Category:        model.CashbookCategoryOtherExpense,
			Amount:          expenseAmount,
			PaymentMethod:   model.CashbookPaymentMethodCash,
			Description:     desc,
		}

		if err := db.Create(cashTx).Error; err != nil {
			return nil, nil, err
		}
	}

	return mov, cashTx, nil
}
