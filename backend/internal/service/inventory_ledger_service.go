package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

type RecordMovementParams struct {
	VariantID      string
	BatchID        *string
	MovementType   model.MovementType
	QtyInBaseUom   decimal.Decimal
	InputUOM       string
	InputQty       decimal.Decimal
	UnitCostAtTime decimal.Decimal
	ReferenceID    *string
	ReasonNote     *string
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

	inputUOM := params.InputUOM
	if inputUOM == "" && variant.Product != nil {
		inputUOM = variant.Product.BaseUom
	}

	movement := &model.InventoryMovement{
		VariantID:      params.VariantID,
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
