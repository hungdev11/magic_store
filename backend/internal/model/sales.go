package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PosSession represents a cashier shift session.
type PosSession struct {
	ID                 string                `gorm:"primaryKey;size:64" json:"id"`
	CashierName        string                `gorm:"not null" json:"cashier_name"`
	StartedAt          time.Time             `gorm:"default:CURRENT_TIMESTAMP" json:"started_at"`
	ClosedAt           *time.Time            `json:"closed_at,omitempty"`
	OpeningCash        decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"opening_cash"`
	ClosingCashActual  *decimal.Decimal      `gorm:"type:decimal(15,2)" json:"closing_cash_actual,omitempty"`
	TotalSalesAmount   decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"total_sales_amount"`
	TotalCashCollected decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"total_cash_collected"`
	TotalBankCollected decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"total_bank_collected"`
	Status             PosSessionStatus      `gorm:"size:50;default:'OPEN'" json:"status"`
	Orders             []SalesOrder          `gorm:"foreignKey:PosSessionID" json:"orders,omitempty"`
	CashbookEntries    []CashbookTransaction `gorm:"foreignKey:PosSessionID" json:"cashbook_entries,omitempty"`
	CreatedAt          time.Time             `json:"created_at"`
	UpdatedAt          time.Time             `json:"updated_at"`
}

func (s *PosSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

// SalesOrder represents a customer sale or POS transaction.
type SalesOrder struct {
	ID              string                `gorm:"primaryKey;size:64" json:"id"`
	OrderNumber     string                `gorm:"uniqueIndex;not null" json:"order_number"`
	CustomerID      *string               `gorm:"size:64;index" json:"customer_id,omitempty"`
	Customer        *Partner              `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	PosSessionID    *string               `gorm:"size:64;index" json:"pos_session_id,omitempty"`
	PosSession      *PosSession           `gorm:"foreignKey:PosSessionID" json:"pos_session,omitempty"`
	Status          OrderStatus           `gorm:"size:50;index;default:'COMPLETED'" json:"status"`
	Subtotal        decimal.Decimal       `gorm:"type:decimal(15,2);not null" json:"subtotal"`
	DiscountAmount  decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"discount_amount"`
	SurchargeAmount decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"surcharge_amount"`
	TotalAmount     decimal.Decimal       `gorm:"type:decimal(15,2);not null" json:"total_amount"`
	PaidAmount      decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"paid_amount"`
	DebtAmount      decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"debt_amount"`
	TotalCogs       decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"total_cogs"`
	PaymentMethod   PaymentMethod         `gorm:"size:50;default:'CASH'" json:"payment_method"`
	Items           []SalesOrderItem      `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	CashbookEntries []CashbookTransaction `gorm:"foreignKey:SalesOrderID" json:"cashbook_entries,omitempty"`
	CreatedAt       time.Time             `gorm:"index;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
}

func (o *SalesOrder) BeforeCreate(tx *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.New().String()
	}
	return nil
}

// SalesOrderItem represents an item line inside a SalesOrder.
type SalesOrderItem struct {
	ID                    string           `gorm:"primaryKey;size:64" json:"id"`
	OrderID               string           `gorm:"size:64;index;not null" json:"order_id"`
	Order                 *SalesOrder      `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"order,omitempty"`
	VariantID             string           `gorm:"size:64;index;not null" json:"variant_id"`
	Variant               *ProductVariant  `gorm:"foreignKey:VariantID" json:"variant,omitempty"`
	BatchID               *string          `gorm:"size:64;index" json:"batch_id,omitempty"`
	Batch                 *InventoryBatch  `gorm:"foreignKey:BatchID" json:"batch,omitempty"`
	SoldUom               string           `gorm:"not null" json:"sold_uom"`
	SoldQty               decimal.Decimal  `gorm:"type:decimal(12,4);not null" json:"sold_qty"`
	ActualBaseQtyDeducted decimal.Decimal  `gorm:"type:decimal(12,4);not null" json:"actual_base_qty_deducted"`
	OriginalUnitPrice     decimal.Decimal  `gorm:"type:decimal(15,2);not null" json:"original_unit_price"`
	ActualUnitPrice       decimal.Decimal  `gorm:"type:decimal(15,2);not null" json:"actual_unit_price"`
	LineTotal             decimal.Decimal  `gorm:"type:decimal(15,2);default:0" json:"line_total"`
	ModifiersJSON         *string          `gorm:"type:text;column:modifiers_json" json:"modifiers_json,omitempty"`
	LineCogs              decimal.Decimal  `gorm:"type:decimal(15,2);default:0" json:"line_cogs"`
	IsReturn              bool             `gorm:"default:false" json:"is_return"`
	CreatedAt             time.Time        `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (i *SalesOrderItem) BeforeCreate(tx *gorm.DB) error {
	if i.ID == "" {
		i.ID = uuid.New().String()
	}
	return nil
}
