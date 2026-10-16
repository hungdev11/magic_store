package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StoreSetting defines global operational configuration for the store.
type StoreSetting struct {
	ID             string        `gorm:"primaryKey;size:64" json:"id"`
	Name           string        `gorm:"not null" json:"name"`
	Currency       string        `gorm:"size:10;default:'VND'" json:"currency"`
	CostingMethod  CostingMethod `gorm:"size:20;default:'WAC'" json:"costing_method"`
	EnabledModules string        `gorm:"type:text" json:"enabled_modules"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

func (s *StoreSetting) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}
