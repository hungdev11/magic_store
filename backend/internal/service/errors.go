package service

import "errors"

var (
	ErrVariableRatioWeightRequired = errors.New("actual weight is required for variable-ratio uom")
	ErrMinPriceViolation           = errors.New("price is below minimum selling price")
	ErrVariantNotFound             = errors.New("product variant not found")
	ErrConversionNotFound          = errors.New("uom conversion not found")
)
