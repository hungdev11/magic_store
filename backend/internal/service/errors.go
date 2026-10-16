package service

import "errors"

var (
	ErrVariableRatioWeightRequired = errors.New("actual weight is required for variable-ratio uom")
	ErrMinPriceViolation           = errors.New("price is below minimum selling price")
	ErrVariantNotFound             = errors.New("product variant not found")
	ErrConversionNotFound          = errors.New("uom conversion not found")
	ErrInvalidConversionFactor     = errors.New("conversion factor cannot be zero")
	ErrBatchNotFound               = errors.New("inventory batch not found")
	ErrRecipeNotFound              = errors.New("bom recipe not found")
	ErrInvalidYieldQty             = errors.New("yield quantity must be positive")
	ErrInvalidInputQty             = errors.New("input quantity must be positive")
	ErrBatchMismatch               = errors.New("batch does not belong to variant")
	ErrProductNotFound             = errors.New("product not found for variant")
)
