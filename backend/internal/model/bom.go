package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// BomRecipe defines bill of materials for manufacturing or disassembly.
type BomRecipe struct {
	ID                     string            `gorm:"primaryKey;size:64" json:"id"`
	TargetVariantID        string            `gorm:"size:64;index;not null" json:"target_variant_id"`
	TargetVariant          *ProductVariant   `gorm:"foreignKey:TargetVariantID" json:"target_variant,omitempty"`
	RecipeType             RecipeType        `gorm:"size:50;not null" json:"recipe_type"`
	OutputQty              decimal.Decimal   `gorm:"type:decimal(12,4);not null" json:"output_qty"`
	ExpectedWastagePercent decimal.Decimal   `gorm:"type:decimal(5,2);default:0" json:"expected_wastage_percent"`
	EstimatedUnitCost      decimal.Decimal   `gorm:"-" json:"estimated_unit_cost,omitempty"`
	Items                  []BomItem         `gorm:"foreignKey:RecipeID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	ProductionOrders       []ProductionOrder `gorm:"foreignKey:RecipeID" json:"production_orders,omitempty"`
	CreatedAt              time.Time         `json:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at"`
}

func (r *BomRecipe) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}

// BomItem specifies an ingredient or component in a BomRecipe.
type BomItem struct {
	ID                    string          `gorm:"primaryKey;size:64" json:"id"`
	RecipeID              string          `gorm:"size:64;uniqueIndex:idx_recipe_comp;index;not null" json:"recipe_id"`
	Recipe                *BomRecipe      `gorm:"foreignKey:RecipeID;constraint:OnDelete:CASCADE" json:"recipe,omitempty"`
	ComponentVariantID    string          `gorm:"size:64;uniqueIndex:idx_recipe_comp;index;not null" json:"component_variant_id"`
	ComponentVariant      *ProductVariant `gorm:"foreignKey:ComponentVariantID" json:"component_variant,omitempty"`
	QtyRequired           decimal.Decimal `gorm:"type:decimal(12,4);not null" json:"qty_required"`
	CostAllocationPercent decimal.Decimal `gorm:"type:decimal(5,2);default:0" json:"cost_allocation_percent"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at"`
}

func (i *BomItem) BeforeCreate(tx *gorm.DB) error {
	if i.ID == "" {
		i.ID = uuid.New().String()
	}
	return nil
}

// ProductionOrder tracks the execution of a BOM recipe.
type ProductionOrder struct {
	ID                string           `gorm:"primaryKey;size:64" json:"id"`
	RecipeID          string           `gorm:"size:64;index;not null" json:"recipe_id"`
	Recipe            *BomRecipe       `gorm:"foreignKey:RecipeID" json:"recipe,omitempty"`
	BatchCode         *string          `json:"batch_code,omitempty"`
	Status            ProductionStatus `gorm:"size:50;index;default:'DRAFT'" json:"status"`
	InputQty          decimal.Decimal  `gorm:"type:decimal(12,4);not null" json:"input_qty"`
	ActualYieldQty    decimal.Decimal  `gorm:"type:decimal(12,4);default:0" json:"actual_yield_qty"`
	TotalMaterialCost decimal.Decimal  `gorm:"type:decimal(15,2);default:0" json:"total_material_cost"`
	OtherCost         decimal.Decimal  `gorm:"type:decimal(15,2);default:0" json:"other_cost"`
	Notes             *string          `json:"notes,omitempty"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

func (p *ProductionOrder) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}
