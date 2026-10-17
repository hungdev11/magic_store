package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

// handleDirectUpload handles multipart/form-data image upload directly to the server.
// ponytail: local disk upload fallback; upgrade to S3/CDN if multi-region edge caching needed.
func (s *Server) handleDirectUpload(w http.ResponseWriter, r *http.Request) {
	// 10 MB max memory
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "Dung lượng file vượt quá giới hạn hoặc định dạng không đúng")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Vui lòng đính kèm trường 'file'")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		writeError(w, http.StatusBadRequest, "Chỉ hỗ trợ file ảnh (.jpg, .jpeg, .png, .webp, .gif)")
		return
	}

	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "Không thể tạo thư mục lưu trữ ảnh")
		return
	}

	safeName := fmt.Sprintf("%s-%s%s", time.Now().Format("20060102150405"), uuid.New().String()[:8], ext)
	dstPath := filepath.Join(uploadDir, safeName)

	dst, err := os.Create(dstPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Lỗi tạo file trên hệ thống")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		writeError(w, http.StatusInternalServerError, "Lỗi ghi dữ liệu file")
		return
	}

	fileURL := fmt.Sprintf("/uploads/%s", safeName)
	writeJSON(w, http.StatusOK, map[string]string{
		"file_url":    fileURL,
		"object_name": safeName,
		"filename":    header.Filename,
	})
}
