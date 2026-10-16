package service

import (
	"context"
	"errors"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"magic_store/backend/internal/model"
)

type ToBaseQtyParams struct {
	VariantID    string
	InputUOM     string
	InputQty     decimal.Decimal
	ActualWeight *decimal.Decimal
}

type FromBaseQtyParams struct {
	VariantID string
	TargetUOM string
	BaseQty   decimal.Decimal
}

type CalculateLinePriceParams struct {
	VariantID          string
	SoldUOM            string
	SoldQty            decimal.Decimal
	ActualBaseQty      *decimal.Decimal
	OverrideUnitPrice  *decimal.Decimal
	AllowBelowMinPrice bool
}

type LinePriceResult struct {
	UnitPrice         decimal.Decimal
	LineTotal         decimal.Decimal
	ActualDeductedQty decimal.Decimal
	IsPriceOverridden bool
}

type UOMService struct {
	db *gorm.DB
}

func NewUOMService(db *gorm.DB) *UOMService {
	return &UOMService{db: db}
}

// ponytail: fallback to s.db if tx is nil; upgrade to explicit transaction manager if distributed tx needed.
func (s *UOMService) getDB(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return s.db
}

func (s *UOMService) ToBaseQty(ctx context.Context, tx *gorm.DB, params ToBaseQtyParams) (decimal.Decimal, error) {
	db := s.getDB(tx).WithContext(ctx)

	var variant model.ProductVariant
	if err := db.Preload("Product").First(&variant, "id = ?", params.VariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, ErrVariantNotFound
		}
		return decimal.Zero, err
	}

	if variant.Product == nil {
		return decimal.Zero, ErrProductNotFound
	}

	if params.InputUOM == variant.Product.BaseUom {
		if params.ActualWeight != nil {
			return *params.ActualWeight, nil
		}
		return params.InputQty, nil
	}

	var conversion model.UomConversion
	if err := db.Where("variant_id = ? AND uom_name = ?", params.VariantID, params.InputUOM).First(&conversion).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, ErrConversionNotFound
		}
		return decimal.Zero, err
	}

	if conversion.IsVariableRatio {
		if params.ActualWeight == nil {
			return decimal.Zero, ErrVariableRatioWeightRequired
		}
		return *params.ActualWeight, nil
	}

	return params.InputQty.Mul(conversion.ConversionFactor), nil
}

func (s *UOMService) FromBaseQty(ctx context.Context, tx *gorm.DB, params FromBaseQtyParams) (decimal.Decimal, error) {
	db := s.getDB(tx).WithContext(ctx)

	var variant model.ProductVariant
	if err := db.Preload("Product").First(&variant, "id = ?", params.VariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, ErrVariantNotFound
		}
		return decimal.Zero, err
	}

	if variant.Product == nil {
		return decimal.Zero, ErrProductNotFound
	}

	if params.TargetUOM == variant.Product.BaseUom {
		return params.BaseQty, nil
	}

	var conversion model.UomConversion
	if err := db.Where("variant_id = ? AND uom_name = ?", params.VariantID, params.TargetUOM).First(&conversion).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, ErrConversionNotFound
		}
		return decimal.Zero, err
	}

	if conversion.ConversionFactor.IsZero() {
		return decimal.Zero, ErrInvalidConversionFactor
	}

	return params.BaseQty.Div(conversion.ConversionFactor), nil
}

func (s *UOMService) CalculateLinePrice(ctx context.Context, tx *gorm.DB, params CalculateLinePriceParams) (*LinePriceResult, error) {
	db := s.getDB(tx).WithContext(ctx)

	var variant model.ProductVariant
	if err := db.Preload("Product").Preload("UomConversions").First(&variant, "id = ?", params.VariantID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrVariantNotFound
		}
		return nil, err
	}

	if variant.Product == nil {
		return nil, ErrProductNotFound
	}

	isBaseUom := params.SoldUOM == variant.Product.BaseUom
	var conversion *model.UomConversion
	if !isBaseUom {
		for i := range variant.UomConversions {
			if variant.UomConversions[i].UomName == params.SoldUOM {
				conversion = &variant.UomConversions[i]
				break
			}
		}
		if conversion == nil {
			return nil, ErrConversionNotFound
		}
	}

	isVariableRatio := conversion != nil && conversion.IsVariableRatio

	var actualDeductedQty decimal.Decimal
	if isVariableRatio {
		if params.ActualBaseQty == nil {
			return nil, ErrVariableRatioWeightRequired
		}
		actualDeductedQty = *params.ActualBaseQty
	} else if isBaseUom {
		if params.ActualBaseQty != nil {
			actualDeductedQty = *params.ActualBaseQty
		} else {
			actualDeductedQty = params.SoldQty
		}
	} else {
		if params.ActualBaseQty != nil {
			actualDeductedQty = *params.ActualBaseQty
		} else {
			actualDeductedQty = params.SoldQty.Mul(conversion.ConversionFactor)
		}
	}

	var unitPrice decimal.Decimal
	isPriceOverridden := false

	if params.OverrideUnitPrice != nil {
		isPriceOverridden = true
		unitPrice = *params.OverrideUnitPrice

		minAllowedPrice := variant.MinSellingPrice
		if conversion != nil && !conversion.IsVariableRatio {
			minAllowedPrice = minAllowedPrice.Mul(conversion.ConversionFactor)
		}

		if unitPrice.LessThan(minAllowedPrice) && !params.AllowBelowMinPrice {
			return nil, ErrMinPriceViolation
		}
	} else {
		if isBaseUom {
			unitPrice = variant.BaseSellingPrice
		} else {
			if conversion.DefaultPriceForUom != nil {
				unitPrice = *conversion.DefaultPriceForUom
			} else if conversion.IsVariableRatio {
				unitPrice = variant.BaseSellingPrice
			} else {
				unitPrice = variant.BaseSellingPrice.Mul(conversion.ConversionFactor)
			}
		}
	}

	var lineTotal decimal.Decimal
	if isVariableRatio || isBaseUom {
		lineTotal = actualDeductedQty.Mul(unitPrice)
	} else {
		lineTotal = params.SoldQty.Mul(unitPrice)
	}

	return &LinePriceResult{
		UnitPrice:         unitPrice,
		LineTotal:         lineTotal,
		ActualDeductedQty: actualDeductedQty,
		IsPriceOverridden: isPriceOverridden,
	}, nil
}
