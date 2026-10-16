package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// DebtLedger records customer and supplier receivables/payables history.
type DebtLedger struct {
	ID              string              `gorm:"primaryKey;size:64" json:"id"`
	PartnerID       string              `gorm:"size:64;index;not null" json:"partner_id"`
	Partner         *Partner            `gorm:"foreignKey:PartnerID" json:"partner,omitempty"`
	TransactionType DebtTransactionType `gorm:"size:50;not null" json:"transaction_type"`
	ReferenceID     *string             `gorm:"size:64;index" json:"reference_id,omitempty"`
	Amount          decimal.Decimal     `gorm:"type:decimal(15,2);not null" json:"amount"`
	BalanceAfter    decimal.Decimal     `gorm:"type:decimal(15,2);not null" json:"balance_after"`
	Note            *string             `json:"note,omitempty"`
	CreatedAt       time.Time           `gorm:"index;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (d *DebtLedger) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	return nil
}

// CashbookTransaction tracks real cash and bank inflows and outflows.
type CashbookTransaction struct {
	ID              string                `gorm:"primaryKey;size:64" json:"id"`
	TransactionType CashbookType          `gorm:"size:50;not null" json:"transaction_type"`
	Category        CashbookCategory      `gorm:"size:50;index;not null" json:"category"`
	Amount          decimal.Decimal       `gorm:"type:decimal(15,2);not null" json:"amount"`
	PaymentMethod   CashbookPaymentMethod `gorm:"size:50;default:'CASH'" json:"payment_method"`
	PartnerID       *string               `gorm:"size:64;index" json:"partner_id,omitempty"`
	Partner         *Partner              `gorm:"foreignKey:PartnerID" json:"partner,omitempty"`
	SalesOrderID    *string               `gorm:"size:64;index" json:"sales_order_id,omitempty"`
	SalesOrder      *SalesOrder           `gorm:"foreignKey:SalesOrderID" json:"sales_order,omitempty"`
	PosSessionID    *string               `gorm:"size:64;index" json:"pos_session_id,omitempty"`
	PosSession      *PosSession           `gorm:"foreignKey:PosSessionID" json:"pos_session,omitempty"`
	Description     string                `gorm:"not null" json:"description"`
	CreatedAt       time.Time             `gorm:"index;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (c *CashbookTransaction) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}
