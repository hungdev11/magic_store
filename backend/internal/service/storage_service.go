package service

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var (
	ErrInvalidContentType = errors.New("chỉ hỗ trợ định dạng ảnh (.jpg, .jpeg, .png, .webp, .gif)")
	ErrMissingFilename    = errors.New("tên file không được để trống")
)

type StorageConfig struct {
	Endpoint   string
	AccessKey  string
	SecretKey  string
	BucketName string
	UseSSL     bool
	PublicURL  string
}

type StorageService struct {
	client     *minio.Client
	bucketName string
	publicURL  string
}

type PresignedURLResponse struct {
	UploadURL  string `json:"upload_url"`
	FileURL    string `json:"file_url"`
	ObjectName string `json:"object_name"`
}

func NewStorageService(cfg StorageConfig) (*StorageService, error) {
	if cfg.Endpoint == "" {
		cfg.Endpoint = "localhost:9000"
	}
	if cfg.BucketName == "" {
		cfg.BucketName = "products"
	}
	if cfg.PublicURL == "" {
		cfg.PublicURL = fmt.Sprintf("http://%s", cfg.Endpoint)
	}

	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: "us-east-1",
	})
	if err != nil {
		return nil, fmt.Errorf("không thể khởi tạo MinIO client: %w", err)
	}

	svc := &StorageService{
		client:     client,
		bucketName: cfg.BucketName,
		publicURL:  strings.TrimRight(cfg.PublicURL, "/"),
	}

	return svc, nil
}

func (s *StorageService) GetPresignedUploadURL(ctx context.Context, filename, contentType string) (*PresignedURLResponse, error) {
	if strings.TrimSpace(filename) == "" {
		return nil, ErrMissingFilename
	}

	validTypes := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/webp": true,
		"image/gif":  true,
	}
	if !validTypes[contentType] {
		return nil, ErrInvalidContentType
	}

	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		ext = ".jpg"
	}

	objectName := fmt.Sprintf("%s-%s%s", time.Now().Format("20060102"), uuid.New().String()[:8], ext)

	// Presigned URL for PUT with 15 mins expiry
	expiry := 15 * time.Minute
	presignedURL, err := s.client.PresignedPutObject(ctx, s.bucketName, objectName, expiry)
	if err != nil {
		return nil, fmt.Errorf("lỗi tạo presigned URL: %w", err)
	}

	fileURL := fmt.Sprintf("%s/%s/%s", s.publicURL, s.bucketName, objectName)

	return &PresignedURLResponse{
		UploadURL:  presignedURL.String(),
		FileURL:    fileURL,
		ObjectName: objectName,
	}, nil
}
