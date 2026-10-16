package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Partner represents a customer, supplier, or dual-role commercial entity.
type Partner struct {
	ID                 string                `gorm:"primaryKey;size:64" json:"id"`
	PartnerType        PartnerType           `gorm:"size:50;not null" json:"partner_type"`
	Name               string                `gorm:"not null" json:"name"`
	Phone              *string               `json:"phone,omitempty"`
	Address            *string               `json:"address,omitempty"`
	PriceTier          string                `gorm:"default:'RETAIL'" json:"price_tier"`
	CurrentDebtBalance decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"current_debt_balance"`
	CreditLimit        decimal.Decimal       `gorm:"type:decimal(15,2);default:0" json:"credit_limit"`
	IsActive           bool                  `gorm:"default:true" json:"is_active"`
	SuppliedBatches    []InventoryBatch      `gorm:"foreignKey:SupplierID" json:"supplied_batches,omitempty"`
	Orders             []SalesOrder          `gorm:"foreignKey:CustomerID" json:"orders,omitempty"`
	DebtEntries        []DebtLedger          `gorm:"foreignKey:PartnerID" json:"debt_entries,omitempty"`
	CashbookEntries    []CashbookTransaction `gorm:"foreignKey:PartnerID" json:"cashbook_entries,omitempty"`
	CreatedAt          time.Time             `json:"created_at"`
	UpdatedAt          time.Time             `json:"updated_at"`
}

func (p *Partner) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}
