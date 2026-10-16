package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Category organizes products hierarchically.
type Category struct {
	ID        string     `gorm:"primaryKey;size:64" json:"id"`
	Name      string     `gorm:"not null" json:"name"`
	Code      string     `gorm:"uniqueIndex;not null" json:"code"`
	IsActive  bool       `gorm:"default:true" json:"is_active"`
	ParentID  *string    `gorm:"size:64" json:"parent_id,omitempty"`
	Parent    *Category  `gorm:"foreignKey:ParentID;constraint:OnDelete:CASCADE" json:"parent,omitempty"`
	Children  []Category `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Products  []Product  `gorm:"foreignKey:CategoryID" json:"products,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (c *Category) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}

// Product represents a catalog master item.
type Product struct {
	ID              string                 `gorm:"primaryKey;size:64" json:"id"`
	Name            string                 `gorm:"not null" json:"name"`
	Code            string                 `gorm:"uniqueIndex;not null" json:"code"`
	CategoryID      string                 `gorm:"size:64;index;not null" json:"category_id"`
	Category        *Category              `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	ProductType     ProductType            `gorm:"size:50;index;not null" json:"product_type"`
	BaseUom         string                 `gorm:"not null" json:"base_uom"`
	IsWeighable     bool                   `gorm:"default:false" json:"is_weighable"`
	TrackInventory  bool                   `gorm:"default:true" json:"track_inventory"`
	TrackBatches    bool                   `gorm:"default:false" json:"track_batches"`
	ProductionMode  ProductionMode         `gorm:"size:50;default:'NONE'" json:"production_mode"`
	Variants        []ProductVariant       `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"variants,omitempty"`
	ModifierGroups  []ProductModifierGroup `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"modifier_groups,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

func (p *Product) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

// ProductVariant represents a specific sellable/inventory SKU under a Product.
type ProductVariant struct {
	ID                 string              `gorm:"primaryKey;size:64" json:"id"`
	ProductID          string              `gorm:"size:64;index;not null" json:"product_id"`
	Product            *Product            `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"product,omitempty"`
	Sku                string              `gorm:"uniqueIndex;not null" json:"sku"`
	Barcode            *string             `gorm:"uniqueIndex" json:"barcode,omitempty"`
	VariantName        string              `gorm:"not null" json:"variant_name"`
	Attributes         string              `gorm:"type:text;default:'{}'" json:"attributes"`
	CostPrice          decimal.Decimal     `gorm:"type:decimal(15,2);default:0" json:"cost_price"`
	BaseSellingPrice   decimal.Decimal     `gorm:"type:decimal(15,2);default:0" json:"base_selling_price"`
	MinSellingPrice    decimal.Decimal     `gorm:"type:decimal(15,2);default:0" json:"min_selling_price"`
	CurrentStock       decimal.Decimal     `gorm:"type:decimal(12,4);default:0" json:"current_stock"`
	MinStockAlert      decimal.Decimal     `gorm:"type:decimal(12,4);default:0" json:"min_stock_alert"`
	UomConversions     []UomConversion     `gorm:"foreignKey:VariantID;constraint:OnDelete:CASCADE" json:"uom_conversions,omitempty"`
	Batches            []InventoryBatch    `gorm:"foreignKey:VariantID" json:"batches,omitempty"`
	Movements          []InventoryMovement `gorm:"foreignKey:VariantID" json:"movements,omitempty"`
	BomRecipesAsTarget []BomRecipe         `gorm:"foreignKey:TargetVariantID" json:"bom_recipes_as_target,omitempty"`
	BomItems           []BomItem           `gorm:"foreignKey:ComponentVariantID" json:"bom_items,omitempty"`
	OrderItems         []SalesOrderItem    `gorm:"foreignKey:VariantID" json:"order_items,omitempty"`
	ModifierItems      []ModifierItem      `gorm:"foreignKey:LinkedVariantID" json:"modifier_items,omitempty"`
	CreatedAt          time.Time           `json:"created_at"`
	UpdatedAt          time.Time           `json:"updated_at"`
}

func (v *ProductVariant) BeforeCreate(tx *gorm.DB) error {
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	return nil
}

// UomConversion maps alternate units of measure to the variant's base UOM.
type UomConversion struct {
	ID                 string           `gorm:"primaryKey;size:64" json:"id"`
	VariantID          string           `gorm:"size:64;uniqueIndex:idx_variant_uom;not null" json:"variant_id"`
	Variant            *ProductVariant  `gorm:"foreignKey:VariantID;constraint:OnDelete:CASCADE" json:"variant,omitempty"`
	UomName            string           `gorm:"uniqueIndex:idx_variant_uom;not null" json:"uom_name"`
	ConversionFactor   decimal.Decimal  `gorm:"type:decimal(12,4);not null" json:"conversion_factor"`
	IsVariableRatio    bool             `gorm:"default:false" json:"is_variable_ratio"`
	DefaultPriceForUom *decimal.Decimal `gorm:"type:decimal(15,2)" json:"default_price_for_uom,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

func (u *UomConversion) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}

// ModifierGroup groups modifiers (toppings, ice level, options) for products.
type ModifierGroup struct {
	ID           string                 `gorm:"primaryKey;size:64" json:"id"`
	Name         string                 `gorm:"not null" json:"name"`
	MinSelection int                    `gorm:"default:0" json:"min_selection"`
	MaxSelection *int                   `json:"max_selection,omitempty"`
	IsRequired   bool                   `gorm:"default:false" json:"is_required"`
	Items        []ModifierItem         `gorm:"foreignKey:ModifierGroupID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	Products     []ProductModifierGroup `gorm:"foreignKey:ModifierGroupID;constraint:OnDelete:CASCADE" json:"products,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

func (m *ModifierGroup) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// ModifierItem is an individual choice within a ModifierGroup.
type ModifierItem struct {
	ID              string           `gorm:"primaryKey;size:64" json:"id"`
	ModifierGroupID string           `gorm:"size:64;index;not null" json:"modifier_group_id"`
	ModifierGroup   *ModifierGroup   `gorm:"foreignKey:ModifierGroupID;constraint:OnDelete:CASCADE" json:"modifier_group,omitempty"`
	Name            string           `gorm:"not null" json:"name"`
	Price           decimal.Decimal  `gorm:"type:decimal(15,2);default:0" json:"price"`
	LinkedVariantID *string          `gorm:"size:64;index" json:"linked_variant_id,omitempty"`
	LinkedVariant   *ProductVariant  `gorm:"foreignKey:LinkedVariantID" json:"linked_variant,omitempty"`
	DeductQty       *decimal.Decimal `gorm:"type:decimal(12,4)" json:"deduct_qty,omitempty"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

func (m *ModifierItem) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// ProductModifierGroup links a Product to an applicable ModifierGroup.
type ProductModifierGroup struct {
	ID              string         `gorm:"primaryKey;size:64" json:"id"`
	ProductID       string         `gorm:"size:64;uniqueIndex:idx_prod_mod_grp;not null" json:"product_id"`
	Product         *Product       `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"product,omitempty"`
	ModifierGroupID string         `gorm:"size:64;uniqueIndex:idx_prod_mod_grp;not null" json:"modifier_group_id"`
	ModifierGroup   *ModifierGroup `gorm:"foreignKey:ModifierGroupID;constraint:OnDelete:CASCADE" json:"modifier_group,omitempty"`
	DisplayOrder    int            `gorm:"default:0" json:"display_order"`
	CreatedAt       time.Time      `json:"created_at"`
}

func (pmg *ProductModifierGroup) BeforeCreate(tx *gorm.DB) error {
	if pmg.ID == "" {
		pmg.ID = uuid.New().String()
	}
	return nil
}
