package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

type RecordMovementParams struct {
	VariantID      string
	WarehouseID    *string
	BatchID        *string
	MovementType   model.MovementType
	QtyInBaseUom   decimal.Decimal
	SecondaryQty   *decimal.Decimal
	InputUOM       string
	InputQty       decimal.Decimal
	UnitCostAtTime decimal.Decimal
	ReferenceID    *string
	ReasonNote     *string
}

type DeductStockParams struct {
	WarehouseID    string
	VariantID      string
	QtyInBaseUom   decimal.Decimal
	SecondaryQty   *decimal.Decimal
	BatchID        *string
	ReferenceID    *string
	ReasonNote     *string
	UnitCostAtTime decimal.Decimal
	SoldUom        string
	SoldQty        decimal.Decimal
}

type ReserveStockParams struct {
	WarehouseID        string
	VariantID          string
	EstimatedBaseQty   decimal.Decimal
	EstimatedSecondary *decimal.Decimal
}

type CommitFulfillmentParams struct {
	WarehouseID              string
	VariantID                string
	EstimatedBaseQty         decimal.Decimal
	ActualFulfilledBaseQty   decimal.Decimal
	EstimatedSecondary       *decimal.Decimal
	ActualFulfilledSecondary *decimal.Decimal
	BatchID                  *string
	ReferenceID              *string
	ReasonNote               *string
	UnitCostAtTime           decimal.Decimal
	SoldUom                  string
	SoldQty                  decimal.Decimal
}

type CancelReservationParams struct {
	WarehouseID        string
	VariantID          string
	EstimatedBaseQty   decimal.Decimal
	EstimatedSecondary *decimal.Decimal
}

type StateTransformParams struct {
	FromVariantID string
	ToVariantID   string
	QtyInBaseUom  decimal.Decimal
	FromBatchID   *string
	ToBatchID     *string
	ReferenceID   *string
	ReasonNote    *string
}

type InventoryLedgerService struct {
	db         *gorm.DB
	uomService *UOMService
}

func NewInventoryLedgerService(db *gorm.DB) *InventoryLedgerService {
	return &InventoryLedgerService{
		db:         db,
		uomService: NewUOMService(db),
	}
}

// RecordMovement records an immutable ledger entry and atomically updates variant and batch stock.
// ponytail: fallback to s.db if tx is nil; upgrade to explicit transaction manager if distributed tx needed.
func (s *InventoryLedgerService) RecordMovement(ctx context.Context, tx *gorm.DB, params RecordMovementParams) (*model.InventoryMovement, error) {
	if tx == nil {
		var mov *model.InventoryMovement
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			mov, err = s.RecordMovement(ctx, innerTx, params)
			return err
		})
		return mov, err
	}

	db := tx.WithContext(ctx)

	var variant model.ProductVariant
	if err := db.Preload("Product").First(&variant, "id = ?", params.VariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrVariantNotFound
		}
		return nil, err
	}

	if params.BatchID != nil && *params.BatchID != "" {
		var batch model.InventoryBatch
		if err := db.First(&batch, "id = ?", *params.BatchID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrBatchNotFound
			}
			return nil, err
		}

		if batch.VariantID != params.VariantID {
			return nil, ErrBatchMismatch
		}

		if err := db.Model(&model.InventoryBatch{}).
			Where("id = ?", *params.BatchID).
			Update("remaining_qty", gorm.Expr("remaining_qty + ?", params.QtyInBaseUom)).Error; err != nil {
			return nil, err
		}
	}

	if err := db.Model(&model.ProductVariant{}).
		Where("id = ?", params.VariantID).
		Update("current_stock", gorm.Expr("current_stock + ?", params.QtyInBaseUom)).Error; err != nil {
		return nil, err
	}

	var warehouseID *string = params.WarehouseID
	if warehouseID == nil || *warehouseID == "" {
		var defWH model.Warehouse
		if err := db.Where("is_default = ?", true).First(&defWH).Error; err == nil {
			warehouseID = &defWH.ID
		} else {
			var firstWH model.Warehouse
			if err := db.Order("created_at asc").First(&firstWH).Error; err == nil {
				warehouseID = &firstWH.ID
			}
		}
	}

	if warehouseID != nil && *warehouseID != "" {
		var ws model.WarehouseStock
		if err := db.Where("warehouse_id = ? AND variant_id = ?", *warehouseID, params.VariantID).First(&ws).Error; err == nil {
			_ = db.Model(&ws).Update("current_stock", gorm.Expr("current_stock + ?", params.QtyInBaseUom)).Error
		} else {
			newWS := model.WarehouseStock{
				ID:           uuid.New().String(),
				WarehouseID:  *warehouseID,
				VariantID:    params.VariantID,
				CurrentStock: params.QtyInBaseUom,
			}
			_ = db.Create(&newWS).Error
		}

		var wsb model.WarehouseStockBalance
		if err := db.Where("warehouse_id = ? AND variant_id = ?", *warehouseID, params.VariantID).First(&wsb).Error; err == nil {
			updates := map[string]interface{}{
				"on_hand_base_qty": gorm.Expr("on_hand_base_qty + ?", params.QtyInBaseUom),
				"version":          gorm.Expr("version + 1"),
				"updated_at":       time.Now(),
			}
			if params.SecondaryQty != nil && !params.SecondaryQty.IsZero() {
				updates["on_hand_secondary_qty"] = gorm.Expr("COALESCE(on_hand_secondary_qty, 0) + ?", params.SecondaryQty)
			}
			_ = db.Model(&wsb).Updates(updates).Error
		} else {
			newWSB := model.WarehouseStockBalance{
				ID:                 uuid.New().String(),
				WarehouseID:        *warehouseID,
				VariantID:          params.VariantID,
				OnHandBaseQty:      params.QtyInBaseUom,
				OnHandSecondaryQty: params.SecondaryQty,
				Version:            1,
			}
			_ = db.Create(&newWSB).Error
		}

		if params.BatchID != nil && *params.BatchID != "" {
			_ = db.Model(&model.InventoryBatch{}).
				Where("id = ? AND (warehouse_id IS NULL OR warehouse_id = '')", *params.BatchID).
				Update("warehouse_id", warehouseID).Error
		}
	}

	inputUOM := params.InputUOM
	if inputUOM == "" && variant.Product != nil {
		inputUOM = variant.Product.BaseUom
	}

	movement := &model.InventoryMovement{
		VariantID:      params.VariantID,
		WarehouseID:    warehouseID,
		BatchID:        params.BatchID,
		MovementType:   params.MovementType,
		QtyInBaseUom:   params.QtyInBaseUom,
		InputUom:       inputUOM,
		InputQty:       params.InputQty,
		UnitCostAtTime: params.UnitCostAtTime,
		ReferenceID:    params.ReferenceID,
		ReasonNote:     params.ReasonNote,
	}

	if err := db.Create(movement).Error; err != nil {
		return nil, err
	}

	return movement, nil
}

// CalculateNewWAC computes the new Weighted Average Cost:
// New WAC = (Current Stock * Current WAC + Incoming Qty * Incoming Cost) / (Current Stock + Incoming Qty)
// If Current Stock <= 0, New WAC = Incoming Cost.
// Persists the new cost price to the variant and returns it.
func (s *InventoryLedgerService) CalculateNewWAC(ctx context.Context, tx *gorm.DB, variantID string, incomingQty, incomingCost decimal.Decimal) (decimal.Decimal, error) {
	if tx == nil {
		var result decimal.Decimal
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			result, err = s.CalculateNewWAC(ctx, innerTx, variantID, incomingQty, incomingCost)
			return err
		})
		return result, err
	}

	db := tx.WithContext(ctx)

	var variant model.ProductVariant
	if err := db.First(&variant, "id = ?", variantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, ErrVariantNotFound
		}
		return decimal.Zero, err
	}

	var newWAC decimal.Decimal
	if variant.CurrentStock.LessThanOrEqual(decimal.Zero) {
		newWAC = incomingCost
	} else {
		totalQty := variant.CurrentStock.Add(incomingQty)
		if totalQty.LessThanOrEqual(decimal.Zero) {
			newWAC = incomingCost
		} else {
			totalCost := variant.CurrentStock.Mul(variant.CostPrice).Add(incomingQty.Mul(incomingCost))
			newWAC = totalCost.Div(totalQty)
		}
	}

	if err := db.Model(&model.ProductVariant{}).Where("id = ?", variantID).Update("cost_price", newWAC).Error; err != nil {
		return decimal.Zero, err
	}

	return newWAC, nil
}

// StateTransform converts stock from one variant state to another (e.g. Live Fish to Dead Fish) in a single atomic transaction.
// Inherits the cost from fromVariant and updates toVariant WAC and stocks with paired STATE_TRANSFORM movements.
// ponytail: 1-to-1 variant state transform; upgrade to N-to-M recipe transforms if byproduct split needed.
func (s *InventoryLedgerService) StateTransform(ctx context.Context, tx *gorm.DB, params StateTransformParams) (*model.InventoryMovement, *model.InventoryMovement, error) {
	if tx == nil {
		var outMov, inMov *model.InventoryMovement
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			outMov, inMov, err = s.StateTransform(ctx, innerTx, params)
			return err
		})
		return outMov, inMov, err
	}

	db := tx.WithContext(ctx)

	if params.QtyInBaseUom.LessThanOrEqual(decimal.Zero) {
		return nil, nil, errors.New("transform quantity must be positive")
	}

	var fromVariant model.ProductVariant
	if err := db.Preload("Product").First(&fromVariant, "id = ?", params.FromVariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrVariantNotFound
		}
		return nil, nil, err
	}
	if fromVariant.Product == nil {
		return nil, nil, ErrProductNotFound
	}

	var toVariant model.ProductVariant
	if err := db.Preload("Product").First(&toVariant, "id = ?", params.ToVariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrVariantNotFound
		}
		return nil, nil, err
	}
	if toVariant.Product == nil {
		return nil, nil, ErrProductNotFound
	}

	unitCost := fromVariant.CostPrice
	qty := params.QtyInBaseUom

	refID := params.ReferenceID
	if refID == nil || *refID == "" {
		generated := uuid.New().String()
		refID = &generated
	}

	fromUom := ""
	if fromVariant.Product != nil {
		fromUom = fromVariant.Product.BaseUom
	}

	toUom := ""
	if toVariant.Product != nil {
		toUom = toVariant.Product.BaseUom
	}

	// 1. Record outgoing movement from fromVariant (-qty)
	outMov, err := s.RecordMovement(ctx, db, RecordMovementParams{
		VariantID:      fromVariant.ID,
		BatchID:        params.FromBatchID,
		MovementType:   model.MovementTypeStateTransform,
		QtyInBaseUom:   qty.Neg(),
		InputUOM:       fromUom,
		InputQty:       qty.Neg(),
		UnitCostAtTime: unitCost,
		ReferenceID:    refID,
		ReasonNote:     params.ReasonNote,
	})
	if err != nil {
		return nil, nil, err
	}

	// 2. Compute and persist new WAC for toVariant BEFORE stock increment
	if _, err := s.CalculateNewWAC(ctx, db, toVariant.ID, qty, unitCost); err != nil {
		return nil, nil, err
	}

	// 3. Record incoming movement to toVariant (+qty)
	inMov, err := s.RecordMovement(ctx, db, RecordMovementParams{
		VariantID:      toVariant.ID,
		BatchID:        params.ToBatchID,
		MovementType:   model.MovementTypeStateTransform,
		QtyInBaseUom:   qty,
		InputUOM:       toUom,
		InputQty:       qty,
		UnitCostAtTime: unitCost,
		ReferenceID:    refID,
		ReasonNote:     params.ReasonNote,
	})
	if err != nil {
		return nil, nil, err
	}

	return outMov, inMov, nil
}

// DeductStockAtomic performs 1-phase immediate POS stock deduction with atomic availability check and catch-weight auto-zeroing.
func (s *InventoryLedgerService) DeductStockAtomic(ctx context.Context, tx *gorm.DB, params DeductStockParams) (*model.InventoryMovement, error) {
	if tx == nil {
		var mov *model.InventoryMovement
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			mov, err = s.DeductStockAtomic(ctx, innerTx, params)
			return err
		})
		return mov, err
	}

	db := tx.WithContext(ctx)

	if params.QtyInBaseUom.LessThanOrEqual(decimal.Zero) {
		return nil, errors.New("deduct quantity must be positive")
	}

	var wh model.Warehouse
	if err := db.First(&wh, "id = ?", params.WarehouseID).Error; err != nil {
		return nil, err
	}

	var variant model.ProductVariant
	if err := db.Preload("Product").First(&variant, "id = ?", params.VariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrVariantNotFound
		}
		return nil, err
	}

	// 1. Ensure balance row exists
	var wsb model.WarehouseStockBalance
	if err := db.Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).First(&wsb).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if !wh.AllowNegativeStock {
				return nil, ErrInsufficientStock
			}
			wsb = model.WarehouseStockBalance{
				ID:          uuid.New().String(),
				WarehouseID: params.WarehouseID,
				VariantID:   params.VariantID,
				Version:     1,
			}
			if err := db.Create(&wsb).Error; err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	// 2. Atomic conditional deduction
	query := db.Model(&model.WarehouseStockBalance{}).
		Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID)

	if !wh.AllowNegativeStock {
		query = query.Where("(on_hand_base_qty - reserved_base_qty - locked_base_qty) >= CAST(? AS NUMERIC)", params.QtyInBaseUom.String())
	}

	updates := map[string]interface{}{
		"on_hand_base_qty": gorm.Expr("on_hand_base_qty - ?", params.QtyInBaseUom),
		"version":          gorm.Expr("version + 1"),
		"updated_at":       time.Now(),
	}
	if params.SecondaryQty != nil && params.SecondaryQty.IsPositive() {
		updates["on_hand_secondary_qty"] = gorm.Expr("COALESCE(on_hand_secondary_qty, 0) - ?", params.SecondaryQty)
	}

	res := query.Updates(updates)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, ErrInsufficientStock
	}

	// 3. Update legacy balances and batches
	_ = db.Model(&model.ProductVariant{}).
		Where("id = ?", params.VariantID).
		Update("current_stock", gorm.Expr("current_stock - ?", params.QtyInBaseUom)).Error

	_ = db.Model(&model.WarehouseStock{}).
		Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).
		Update("current_stock", gorm.Expr("current_stock - ?", params.QtyInBaseUom)).Error

	if params.BatchID != nil && *params.BatchID != "" {
		_ = db.Model(&model.InventoryBatch{}).
			Where("id = ?", *params.BatchID).
			Update("remaining_qty", gorm.Expr("remaining_qty - ?", params.QtyInBaseUom)).Error
	}

	// 4. Catch-Weight Auto-Zeroing rule
	if params.SecondaryQty != nil && params.SecondaryQty.IsPositive() {
		var updatedWSB model.WarehouseStockBalance
		if err := db.Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).First(&updatedWSB).Error; err == nil {
			if updatedWSB.OnHandSecondaryQty != nil && updatedWSB.OnHandSecondaryQty.LessThanOrEqual(decimal.Zero) && updatedWSB.OnHandBaseQty.GreaterThan(decimal.Zero) {
				shrinkage := updatedWSB.OnHandBaseQty
				note := "Tự động kết chuyển hao hụt tự nhiên khi hết số con (Auto-Zeroing Shrinkage)"

				_ = db.Model(&updatedWSB).Updates(map[string]interface{}{
					"on_hand_base_qty": decimal.Zero,
					"version":          gorm.Expr("version + 1"),
					"updated_at":       time.Now(),
				}).Error

				_ = db.Model(&model.ProductVariant{}).Where("id = ?", params.VariantID).
					Update("current_stock", gorm.Expr("current_stock - ?", shrinkage)).Error

				_ = db.Model(&model.WarehouseStock{}).Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).
					Update("current_stock", gorm.Expr("current_stock - ?", shrinkage)).Error

				shrinkageMov := &model.InventoryMovement{
					VariantID:      params.VariantID,
					WarehouseID:    &params.WarehouseID,
					BatchID:        params.BatchID,
					MovementType:   model.MovementTypeNaturalShrinkage,
					QtyInBaseUom:   shrinkage.Neg(),
					InputUom:       params.SoldUom,
					InputQty:       shrinkage.Neg(),
					UnitCostAtTime: params.UnitCostAtTime,
					ReferenceID:    params.ReferenceID,
					ReasonNote:     &note,
				}
				_ = db.Create(shrinkageMov).Error
			}
		}
	}

	soldUom := params.SoldUom
	if soldUom == "" && variant.Product != nil {
		soldUom = variant.Product.BaseUom
	}
	soldQty := params.SoldQty
	if soldQty.IsZero() {
		soldQty = params.QtyInBaseUom
	}

	// 5. Create immutable movement ledger
	movement := &model.InventoryMovement{
		VariantID:      params.VariantID,
		WarehouseID:    &params.WarehouseID,
		BatchID:        params.BatchID,
		MovementType:   model.MovementTypeSaleOut,
		QtyInBaseUom:   params.QtyInBaseUom.Neg(),
		InputUom:       soldUom,
		InputQty:       soldQty.Neg(),
		UnitCostAtTime: params.UnitCostAtTime,
		ReferenceID:    params.ReferenceID,
		ReasonNote:     params.ReasonNote,
	}
	if err := db.Create(movement).Error; err != nil {
		return nil, err
	}

	return movement, nil
}

// ReserveStock increments reserved_base_qty if available stock is sufficient.
func (s *InventoryLedgerService) ReserveStock(ctx context.Context, tx *gorm.DB, params ReserveStockParams) error {
	if tx == nil {
		return s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			return s.ReserveStock(ctx, innerTx, params)
		})
	}

	db := tx.WithContext(ctx)

	if params.EstimatedBaseQty.LessThanOrEqual(decimal.Zero) {
		return errors.New("estimated reservation quantity must be positive")
	}

	var wh model.Warehouse
	if err := db.First(&wh, "id = ?", params.WarehouseID).Error; err != nil {
		return err
	}

	var wsb model.WarehouseStockBalance
	if err := db.Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).First(&wsb).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if !wh.AllowNegativeStock {
				return ErrInsufficientStock
			}
			wsb = model.WarehouseStockBalance{
				ID:          uuid.New().String(),
				WarehouseID: params.WarehouseID,
				VariantID:   params.VariantID,
				Version:     1,
			}
			if err := db.Create(&wsb).Error; err != nil {
				return err
			}
		} else {
			return err
		}
	}

	query := db.Model(&model.WarehouseStockBalance{}).
		Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID)

	if !wh.AllowNegativeStock {
		query = query.Where("(on_hand_base_qty - reserved_base_qty - locked_base_qty) >= CAST(? AS NUMERIC)", params.EstimatedBaseQty.String())
	}

	updates := map[string]interface{}{
		"reserved_base_qty": gorm.Expr("reserved_base_qty + ?", params.EstimatedBaseQty),
		"version":           gorm.Expr("version + 1"),
		"updated_at":        time.Now(),
	}
	if params.EstimatedSecondary != nil && params.EstimatedSecondary.IsPositive() {
		updates["reserved_secondary_qty"] = gorm.Expr("COALESCE(reserved_secondary_qty, 0) + ?", params.EstimatedSecondary)
	}

	res := query.Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrInsufficientStock
	}

	return nil
}

// CommitReservedFulfillment releases reserved_base_qty and deducts actual_fulfilled_base_qty from physical on_hand.
func (s *InventoryLedgerService) CommitReservedFulfillment(ctx context.Context, tx *gorm.DB, params CommitFulfillmentParams) (*model.InventoryMovement, error) {
	if tx == nil {
		var mov *model.InventoryMovement
		err := s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			var err error
			mov, err = s.CommitReservedFulfillment(ctx, innerTx, params)
			return err
		})
		return mov, err
	}

	db := tx.WithContext(ctx)

	if params.ActualFulfilledBaseQty.LessThanOrEqual(decimal.Zero) {
		return nil, errors.New("fulfilled base quantity must be positive")
	}

	var variant model.ProductVariant
	if err := db.Preload("Product").First(&variant, "id = ?", params.VariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrVariantNotFound
		}
		return nil, err
	}

	// 1. Release reserved and decrement on-hand
	updates := map[string]interface{}{
		"reserved_base_qty": gorm.Expr("CASE WHEN reserved_base_qty >= ? THEN reserved_base_qty - ? ELSE 0 END", params.EstimatedBaseQty, params.EstimatedBaseQty),
		"on_hand_base_qty":  gorm.Expr("on_hand_base_qty - ?", params.ActualFulfilledBaseQty),
		"version":           gorm.Expr("version + 1"),
		"updated_at":        time.Now(),
	}
	if params.EstimatedSecondary != nil && params.EstimatedSecondary.IsPositive() {
		updates["reserved_secondary_qty"] = gorm.Expr("CASE WHEN COALESCE(reserved_secondary_qty, 0) >= ? THEN reserved_secondary_qty - ? ELSE 0 END", params.EstimatedSecondary, params.EstimatedSecondary)
	}
	if params.ActualFulfilledSecondary != nil && params.ActualFulfilledSecondary.IsPositive() {
		updates["on_hand_secondary_qty"] = gorm.Expr("COALESCE(on_hand_secondary_qty, 0) - ?", params.ActualFulfilledSecondary)
	}

	if err := db.Model(&model.WarehouseStockBalance{}).
		Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).
		Updates(updates).Error; err != nil {
		return nil, err
	}

	// 2. Legacy balances & variant stock
	_ = db.Model(&model.ProductVariant{}).
		Where("id = ?", params.VariantID).
		Update("current_stock", gorm.Expr("current_stock - ?", params.ActualFulfilledBaseQty)).Error

	_ = db.Model(&model.WarehouseStock{}).
		Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).
		Update("current_stock", gorm.Expr("current_stock - ?", params.ActualFulfilledBaseQty)).Error

	if params.BatchID != nil && *params.BatchID != "" {
		_ = db.Model(&model.InventoryBatch{}).
			Where("id = ?", *params.BatchID).
			Update("remaining_qty", gorm.Expr("remaining_qty - ?", params.ActualFulfilledBaseQty)).Error
	}

	// 3. Catch-Weight Auto-Zeroing
	if params.ActualFulfilledSecondary != nil && params.ActualFulfilledSecondary.IsPositive() {
		var updatedWSB model.WarehouseStockBalance
		if err := db.Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).First(&updatedWSB).Error; err == nil {
			if updatedWSB.OnHandSecondaryQty != nil && updatedWSB.OnHandSecondaryQty.LessThanOrEqual(decimal.Zero) && updatedWSB.OnHandBaseQty.GreaterThan(decimal.Zero) {
				shrinkage := updatedWSB.OnHandBaseQty
				note := "Tự động kết chuyển hao hụt tự nhiên khi hết số con (Auto-Zeroing Shrinkage)"

				_ = db.Model(&updatedWSB).Updates(map[string]interface{}{
					"on_hand_base_qty": decimal.Zero,
					"version":          gorm.Expr("version + 1"),
					"updated_at":       time.Now(),
				}).Error

				_ = db.Model(&model.ProductVariant{}).Where("id = ?", params.VariantID).
					Update("current_stock", gorm.Expr("current_stock - ?", shrinkage)).Error

				_ = db.Model(&model.WarehouseStock{}).Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).
					Update("current_stock", gorm.Expr("current_stock - ?", shrinkage)).Error

				shrinkageMov := &model.InventoryMovement{
					VariantID:      params.VariantID,
					WarehouseID:    &params.WarehouseID,
					BatchID:        params.BatchID,
					MovementType:   model.MovementTypeNaturalShrinkage,
					QtyInBaseUom:   shrinkage.Neg(),
					InputUom:       params.SoldUom,
					InputQty:       shrinkage.Neg(),
					UnitCostAtTime: params.UnitCostAtTime,
					ReferenceID:    params.ReferenceID,
					ReasonNote:     &note,
				}
				_ = db.Create(shrinkageMov).Error
			}
		}
	}

	soldUom := params.SoldUom
	if soldUom == "" && variant.Product != nil {
		soldUom = variant.Product.BaseUom
	}
	soldQty := params.SoldQty
	if soldQty.IsZero() {
		soldQty = params.ActualFulfilledBaseQty
	}

	// 4. Record SALE_OUT movement
	movement := &model.InventoryMovement{
		VariantID:      params.VariantID,
		WarehouseID:    &params.WarehouseID,
		BatchID:        params.BatchID,
		MovementType:   model.MovementTypeSaleOut,
		QtyInBaseUom:   params.ActualFulfilledBaseQty.Neg(),
		InputUom:       soldUom,
		InputQty:       soldQty.Neg(),
		UnitCostAtTime: params.UnitCostAtTime,
		ReferenceID:    params.ReferenceID,
		ReasonNote:     params.ReasonNote,
	}
	if err := db.Create(movement).Error; err != nil {
		return nil, err
	}

	return movement, nil
}

// CancelStockReservation releases reserved stock allocations when an order is cancelled before shipping.
func (s *InventoryLedgerService) CancelStockReservation(ctx context.Context, tx *gorm.DB, params CancelReservationParams) error {
	if tx == nil {
		return s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			return s.CancelStockReservation(ctx, innerTx, params)
		})
	}

	db := tx.WithContext(ctx)

	updates := map[string]interface{}{
		"reserved_base_qty": gorm.Expr("CASE WHEN reserved_base_qty >= ? THEN reserved_base_qty - ? ELSE 0 END", params.EstimatedBaseQty, params.EstimatedBaseQty),
		"version":           gorm.Expr("version + 1"),
		"updated_at":        time.Now(),
	}
	if params.EstimatedSecondary != nil && params.EstimatedSecondary.IsPositive() {
		updates["reserved_secondary_qty"] = gorm.Expr("CASE WHEN COALESCE(reserved_secondary_qty, 0) >= ? THEN reserved_secondary_qty - ? ELSE 0 END", params.EstimatedSecondary, params.EstimatedSecondary)
	}

	return db.Model(&model.WarehouseStockBalance{}).
		Where("warehouse_id = ? AND variant_id = ?", params.WarehouseID, params.VariantID).
		Updates(updates).Error
}

// DispatchStockTransfer processes Step 1 of inter-warehouse transfer: decrements from_warehouse on_hand and increments to_warehouse in_transit.
func (s *InventoryLedgerService) DispatchStockTransfer(ctx context.Context, tx *gorm.DB, transferID string) error {
	if tx == nil {
		return s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			return s.DispatchStockTransfer(ctx, innerTx, transferID)
		})
	}

	db := tx.WithContext(ctx)

	var transfer model.StockTransfer
	if err := db.Preload("Items.Variant.Product").First(&transfer, "id = ?", transferID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTransferNotFound
		}
		return err
	}

	if transfer.Status != model.StockTransferStatusDraft {
		return ErrInvalidTransferState
	}

	var fromWh model.Warehouse
	if err := db.First(&fromWh, "id = ?", transfer.FromWarehouseID).Error; err != nil {
		return err
	}

	for _, item := range transfer.Items {
		// Ensure sender balance exists and check available stock
		var senderWSB model.WarehouseStockBalance
		if err := db.Where("warehouse_id = ? AND variant_id = ?", transfer.FromWarehouseID, item.VariantID).First(&senderWSB).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if !fromWh.AllowNegativeStock {
					return ErrInsufficientStock
				}
				senderWSB = model.WarehouseStockBalance{
					ID:          uuid.New().String(),
					WarehouseID: transfer.FromWarehouseID,
					VariantID:   item.VariantID,
					Version:     1,
				}
				if err := db.Create(&senderWSB).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}

		senderQuery := db.Model(&model.WarehouseStockBalance{}).
			Where("warehouse_id = ? AND variant_id = ?", transfer.FromWarehouseID, item.VariantID)
		if !fromWh.AllowNegativeStock {
			senderQuery = senderQuery.Where("(on_hand_base_qty - reserved_base_qty - locked_base_qty) >= CAST(? AS NUMERIC)", item.Qty.String())
		}

		res := senderQuery.Updates(map[string]interface{}{
			"on_hand_base_qty": gorm.Expr("on_hand_base_qty - ?", item.Qty),
			"version":          gorm.Expr("version + 1"),
			"updated_at":       time.Now(),
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrInsufficientStock
		}

		// Ensure receiver balance exists and increment in_transit_base_qty
		var receiverWSB model.WarehouseStockBalance
		if err := db.Where("warehouse_id = ? AND variant_id = ?", transfer.ToWarehouseID, item.VariantID).First(&receiverWSB).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				receiverWSB = model.WarehouseStockBalance{
					ID:               uuid.New().String(),
					WarehouseID:      transfer.ToWarehouseID,
					VariantID:        item.VariantID,
					InTransitBaseQty: item.Qty,
					Version:          1,
				}
				if err := db.Create(&receiverWSB).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		} else {
			if err := db.Model(&receiverWSB).Updates(map[string]interface{}{
				"in_transit_base_qty": gorm.Expr("in_transit_base_qty + ?", item.Qty),
				"version":             gorm.Expr("version + 1"),
				"updated_at":          time.Now(),
			}).Error; err != nil {
				return err
			}
		}

		// Sync legacy tables
		_ = db.Model(&model.WarehouseStock{}).
			Where("warehouse_id = ? AND variant_id = ?", transfer.FromWarehouseID, item.VariantID).
			Update("current_stock", gorm.Expr("current_stock - ?", item.Qty)).Error

		// Record TRANSFER_OUT movement for FromWarehouse
		unitCost := decimal.Zero
		if item.Variant != nil {
			unitCost = item.Variant.CostPrice
		}
		note := fmt.Sprintf("Xuất điều chuyển: %s", transfer.TransferNumber)
		movement := &model.InventoryMovement{
			VariantID:      item.VariantID,
			WarehouseID:    &transfer.FromWarehouseID,
			BatchID:        item.BatchID,
			MovementType:   model.MovementTypeTransferOut,
			QtyInBaseUom:   item.Qty.Neg(),
			InputUom:       item.Uom,
			InputQty:       item.Qty.Neg(),
			UnitCostAtTime: unitCost,
			ReferenceID:    &transfer.ID,
			ReasonNote:     &note,
		}
		if err := db.Create(movement).Error; err != nil {
			return err
		}
	}

	return db.Model(&transfer).Updates(map[string]interface{}{
		"status":     model.StockTransferStatusInTransit,
		"updated_at": time.Now(),
	}).Error
}

// ReceiveStockTransfer processes Step 2 of inter-warehouse transfer: decrements in_transit, increments to_warehouse on_hand, and records TRANSIT_WASTAGE for shortfall.
func (s *InventoryLedgerService) ReceiveStockTransfer(ctx context.Context, tx *gorm.DB, transferID string, receivedQtys map[string]decimal.Decimal) error {
	if tx == nil {
		return s.db.WithContext(ctx).Transaction(func(innerTx *gorm.DB) error {
			return s.ReceiveStockTransfer(ctx, innerTx, transferID, receivedQtys)
		})
	}

	db := tx.WithContext(ctx)

	var transfer model.StockTransfer
	if err := db.Preload("Items.Variant.Product").First(&transfer, "id = ?", transferID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTransferNotFound
		}
		return err
	}

	if transfer.Status != model.StockTransferStatusInTransit {
		return ErrInvalidTransferState
	}

	for _, item := range transfer.Items {
		sentQty := item.Qty
		actualQty := sentQty
		if q, ok := receivedQtys[item.ID]; ok {
			actualQty = q
		}

		itemUpdates := map[string]interface{}{
			"actual_received_qty": actualQty,
		}

		// Decrement in_transit and increment on_hand in receiver warehouse
		balanceUpdates := map[string]interface{}{
			"in_transit_base_qty": gorm.Expr("CASE WHEN in_transit_base_qty >= ? THEN in_transit_base_qty - ? ELSE 0 END", sentQty, sentQty),
			"on_hand_base_qty":    gorm.Expr("on_hand_base_qty + ?", actualQty),
			"version":             gorm.Expr("version + 1"),
			"updated_at":          time.Now(),
		}

		if err := db.Model(&model.WarehouseStockBalance{}).
			Where("warehouse_id = ? AND variant_id = ?", transfer.ToWarehouseID, item.VariantID).
			Updates(balanceUpdates).Error; err != nil {
			return err
		}

		// Sync legacy tables
		var destWS model.WarehouseStock
		if err := db.Where("warehouse_id = ? AND variant_id = ?", transfer.ToWarehouseID, item.VariantID).First(&destWS).Error; err == nil {
			_ = db.Model(&destWS).Update("current_stock", gorm.Expr("current_stock + ?", actualQty)).Error
		} else {
			newWS := model.WarehouseStock{
				ID:           uuid.New().String(),
				WarehouseID:  transfer.ToWarehouseID,
				VariantID:    item.VariantID,
				CurrentStock: actualQty,
			}
			_ = db.Create(&newWS).Error
		}

		unitCost := decimal.Zero
		if item.Variant != nil {
			unitCost = item.Variant.CostPrice
		}

		// Record TRANSFER_IN movement
		inNote := fmt.Sprintf("Nhập điều chuyển: %s", transfer.TransferNumber)
		inMovement := &model.InventoryMovement{
			VariantID:      item.VariantID,
			WarehouseID:    &transfer.ToWarehouseID,
			BatchID:        item.BatchID,
			MovementType:   model.MovementTypeTransferIn,
			QtyInBaseUom:   actualQty,
			InputUom:       item.Uom,
			InputQty:       actualQty,
			UnitCostAtTime: unitCost,
			ReferenceID:    &transfer.ID,
			ReasonNote:     &inNote,
		}
		if err := db.Create(inMovement).Error; err != nil {
			return err
		}

		// Record TRANSIT_WASTAGE if actual < sent (e.g. ice melt or transport shrinkage)
		if actualQty.LessThan(sentQty) {
			diff := sentQty.Sub(actualQty)
			itemUpdates["transit_wastage_qty"] = diff

			wastageNote := fmt.Sprintf("Hao hụt thất thoát trong quá trình vận chuyển: %s", transfer.TransferNumber)
			wastageMovement := &model.InventoryMovement{
				VariantID:      item.VariantID,
				WarehouseID:    &transfer.ToWarehouseID,
				BatchID:        item.BatchID,
				MovementType:   model.MovementTypeTransitWastage,
				QtyInBaseUom:   diff.Neg(),
				InputUom:       item.Uom,
				InputQty:       diff.Neg(),
				UnitCostAtTime: unitCost,
				ReferenceID:    &transfer.ID,
				ReasonNote:     &wastageNote,
			}
			if err := db.Create(wastageMovement).Error; err != nil {
				return err
			}
		}

		if err := db.Model(&model.StockTransferItem{}).Where("id = ?", item.ID).Updates(itemUpdates).Error; err != nil {
			return err
		}
	}

	return db.Model(&transfer).Updates(map[string]interface{}{
		"status":     model.StockTransferStatusCompleted,
		"updated_at": time.Now(),
	}).Error
}
