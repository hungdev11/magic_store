package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Warehouse defines a physical or logical storage/point-of-sale location.
type Warehouse struct {
	ID                 string                  `gorm:"primaryKey;size:64" json:"id"`
	Code               string                  `gorm:"uniqueIndex;not null;size:50" json:"code"`
	Name               string                  `gorm:"not null;size:150" json:"name"`
	Type               WarehouseType           `gorm:"size:50;default:'STORAGE';not null" json:"type"`
	AllowNegativeStock bool                    `gorm:"default:false" json:"allow_negative_stock"`
	Address            string                  `gorm:"size:255" json:"address,omitempty"`
	IsActive           bool                    `gorm:"default:true" json:"is_active"`
	IsDefault          bool                    `gorm:"default:false" json:"is_default"`
	Balances           []WarehouseStockBalance `gorm:"foreignKey:WarehouseID;constraint:OnDelete:CASCADE" json:"balances,omitempty"`
	Stocks             []WarehouseStock        `gorm:"foreignKey:WarehouseID;constraint:OnDelete:CASCADE" json:"stocks,omitempty"`
	CreatedAt          time.Time               `json:"created_at"`
	UpdatedAt          time.Time               `json:"updated_at"`
}

func (w *Warehouse) BeforeCreate(tx *gorm.DB) error {
	if w.ID == "" {
		w.ID = uuid.New().String()
	}
	return nil
}

// WarehouseStockBalance tracks 4-state inventory balances, Catch-Weight dual UOM, and optimistic concurrency version.
type WarehouseStockBalance struct {
	ID                   string           `gorm:"primaryKey;size:64" json:"id"`
	WarehouseID          string           `gorm:"size:64;uniqueIndex:idx_wh_variant_balance;not null" json:"warehouse_id"`
	Warehouse            *Warehouse       `gorm:"foreignKey:WarehouseID;constraint:OnDelete:CASCADE" json:"warehouse,omitempty"`
	VariantID            string           `gorm:"size:64;uniqueIndex:idx_wh_variant_balance;not null" json:"variant_id"`
	Variant              *ProductVariant  `gorm:"foreignKey:VariantID;constraint:OnDelete:CASCADE" json:"variant,omitempty"`
	OnHandBaseQty        decimal.Decimal  `gorm:"type:decimal(15,4);default:0;not null" json:"on_hand_base_qty"`
	ReservedBaseQty      decimal.Decimal  `gorm:"type:decimal(15,4);default:0;not null" json:"reserved_base_qty"`
	LockedBaseQty        decimal.Decimal  `gorm:"type:decimal(15,4);default:0;not null" json:"locked_base_qty"`
	InTransitBaseQty     decimal.Decimal  `gorm:"type:decimal(15,4);default:0;not null" json:"in_transit_base_qty"`
	OnHandSecondaryQty   *decimal.Decimal `gorm:"type:decimal(15,2)" json:"on_hand_secondary_qty,omitempty"`
	ReservedSecondaryQty *decimal.Decimal `gorm:"type:decimal(15,2)" json:"reserved_secondary_qty,omitempty"`
	WarehouseWacCost     decimal.Decimal  `gorm:"type:decimal(15,4);default:0;not null" json:"warehouse_wac_cost"`
	Version              int              `gorm:"default:1;not null" json:"version"`
	CreatedAt            time.Time        `json:"created_at"`
	UpdatedAt            time.Time        `json:"updated_at"`
}

func (wsb *WarehouseStockBalance) TableName() string {
	return "warehouse_stock_balances"
}

func (wsb *WarehouseStockBalance) BeforeCreate(tx *gorm.DB) error {
	if wsb.ID == "" {
		wsb.ID = uuid.New().String()
	}
	return nil
}

// AvailableBaseQty calculates available to promise quantity: OnHand - Reserved - Locked
func (wsb *WarehouseStockBalance) AvailableBaseQty() decimal.Decimal {
	return wsb.OnHandBaseQty.Sub(wsb.ReservedBaseQty).Sub(wsb.LockedBaseQty)
}

// WarehouseStock tracks inventory quantity of a specific SKU variant at a specific warehouse.
type WarehouseStock struct {
	ID           string          `gorm:"primaryKey;size:64" json:"id"`
	WarehouseID  string          `gorm:"size:64;uniqueIndex:idx_wh_variant;not null" json:"warehouse_id"`
	Warehouse    *Warehouse      `gorm:"foreignKey:WarehouseID;constraint:OnDelete:CASCADE" json:"warehouse,omitempty"`
	VariantID    string          `gorm:"size:64;uniqueIndex:idx_wh_variant;not null" json:"variant_id"`
	Variant      *ProductVariant `gorm:"foreignKey:VariantID;constraint:OnDelete:CASCADE" json:"variant,omitempty"`
	CurrentStock decimal.Decimal `gorm:"type:decimal(12,4);default:0;not null" json:"current_stock"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

func (ws *WarehouseStock) BeforeCreate(tx *gorm.DB) error {
	if ws.ID == "" {
		ws.ID = uuid.New().String()
	}
	return nil
}

// StockTransfer represents an inter-warehouse transfer request.
type StockTransfer struct {
	ID              string              `gorm:"primaryKey;size:64" json:"id"`
	TransferNumber  string              `gorm:"uniqueIndex;not null;size:50" json:"transfer_number"`
	FromWarehouseID string              `gorm:"size:64;index;not null" json:"from_warehouse_id"`
	FromWarehouse   *Warehouse          `gorm:"foreignKey:FromWarehouseID" json:"from_warehouse,omitempty"`
	ToWarehouseID   string              `gorm:"size:64;index;not null" json:"to_warehouse_id"`
	ToWarehouse     *Warehouse          `gorm:"foreignKey:ToWarehouseID" json:"to_warehouse,omitempty"`
	Status          StockTransferStatus `gorm:"size:50;index;default:'DRAFT'" json:"status"`
	Notes           string              `gorm:"size:500" json:"notes,omitempty"`
	Items           []StockTransferItem `gorm:"foreignKey:TransferID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	CreatedAt       time.Time           `gorm:"index;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`
}

func (st *StockTransfer) BeforeCreate(tx *gorm.DB) error {
	if st.ID == "" {
		st.ID = uuid.New().String()
	}
	return nil
}

// StockTransferItem specifies an individual SKU transferred between warehouses.
type StockTransferItem struct {
	ID                string           `gorm:"primaryKey;size:64" json:"id"`
	TransferID        string           `gorm:"size:64;index;not null" json:"transfer_id"`
	VariantID         string           `gorm:"size:64;index;not null" json:"variant_id"`
	Variant           *ProductVariant  `gorm:"foreignKey:VariantID" json:"variant,omitempty"`
	BatchID           *string          `gorm:"size:64;index" json:"batch_id,omitempty"`
	Batch             *InventoryBatch  `gorm:"foreignKey:BatchID" json:"batch,omitempty"`
	Qty               decimal.Decimal  `gorm:"type:decimal(12,4);not null" json:"qty"` // Sent quantity
	ActualReceivedQty *decimal.Decimal `gorm:"type:decimal(15,4)" json:"actual_received_qty,omitempty"`
	TransitWastageQty *decimal.Decimal `gorm:"type:decimal(15,4)" json:"transit_wastage_qty,omitempty"`
	Uom               string           `gorm:"size:50;not null" json:"uom"`
	CreatedAt         time.Time        `json:"created_at"`
}

func (sti *StockTransferItem) BeforeCreate(tx *gorm.DB) error {
	if sti.ID == "" {
		sti.ID = uuid.New().String()
	}
	return nil
}
