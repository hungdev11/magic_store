package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// InventoryBatch tracks stock, expiry, and costs at lot/batch level.
type InventoryBatch struct {
	ID           string              `gorm:"primaryKey;size:64" json:"id"`
	VariantID    string              `gorm:"size:64;uniqueIndex:idx_variant_batch;index;not null" json:"variant_id"`
	Variant      *ProductVariant     `gorm:"foreignKey:VariantID" json:"variant,omitempty"`
	BatchCode    string              `gorm:"uniqueIndex:idx_variant_batch;not null" json:"batch_code"`
	SupplierID   *string             `gorm:"size:64;index" json:"supplier_id,omitempty"`
	Supplier     *Partner            `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	ReceivedDate time.Time           `gorm:"default:CURRENT_TIMESTAMP" json:"received_date"`
	ExpiryDate   *time.Time          `gorm:"index" json:"expiry_date,omitempty"`
	InitialQty   decimal.Decimal     `gorm:"type:decimal(12,4);not null" json:"initial_qty"`
	RemainingQty decimal.Decimal     `gorm:"type:decimal(12,4);not null" json:"remaining_qty"`
	UnitCost     decimal.Decimal     `gorm:"type:decimal(15,2);not null" json:"unit_cost"`
	Notes        string              `json:"notes,omitempty"`
	Movements    []InventoryMovement `gorm:"foreignKey:BatchID" json:"movements,omitempty"`
	OrderItems   []SalesOrderItem    `gorm:"foreignKey:BatchID" json:"order_items,omitempty"`
	CreatedAt    time.Time           `json:"created_at"`
	UpdatedAt    time.Time           `json:"updated_at"`
}

func (b *InventoryBatch) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}

// InventoryMovement represents an immutable transaction in the inventory ledger.
type InventoryMovement struct {
	ID             string          `gorm:"primaryKey;size:64" json:"id"`
	VariantID      string          `gorm:"size:64;index;not null" json:"variant_id"`
	Variant        *ProductVariant `gorm:"foreignKey:VariantID" json:"variant,omitempty"`
	BatchID        *string         `gorm:"size:64;index" json:"batch_id,omitempty"`
	Batch          *InventoryBatch `gorm:"foreignKey:BatchID" json:"batch,omitempty"`
	MovementType   MovementType    `gorm:"size:50;index;not null" json:"movement_type"`
	QtyInBaseUom   decimal.Decimal `gorm:"type:decimal(12,4);not null" json:"qty_in_base_uom"`
	InputUom       string          `gorm:"not null" json:"input_uom"`
	InputQty       decimal.Decimal `gorm:"type:decimal(12,4);not null" json:"input_qty"`
	UnitCostAtTime decimal.Decimal `gorm:"type:decimal(15,2);not null" json:"unit_cost_at_time"`
	ReferenceID    *string         `gorm:"size:64;index" json:"reference_id,omitempty"`
	ReasonNote     *string         `json:"reason_note,omitempty"`
	CreatedAt      time.Time       `gorm:"index;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (m *InventoryMovement) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}
