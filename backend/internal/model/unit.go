package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Unit defines a standardized unit of measure.
type Unit struct {
	ID          string    `gorm:"primaryKey;size:64" json:"id"`
	Code        string    `gorm:"uniqueIndex;not null;size:50" json:"code"`
	Name        string    `gorm:"not null;size:100" json:"name"`
	Description string    `gorm:"size:255" json:"description,omitempty"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (u *Unit) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}
