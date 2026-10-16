package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStorageAPI_PresignedUploadURL(t *testing.T) {
	server, _ := setupTestServerWithDB(t)

	// 1. Invalid content type -> Expect 400 Bad Request
	badPayload := map[string]string{
		"filename":     "virus.exe",
		"content_type": "application/x-msdownload",
	}
	body, _ := json.Marshal(badPayload)
	req := httptest.NewRequest("POST", "/api/upload/presigned-url", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid content type, got %d", w.Code)
	}

	// 2. Valid image -> Expect 200 OK with upload_url and file_url
	validPayload := map[string]string{
		"filename":     "ao-so-mi-trang.jpg",
		"content_type": "image/jpeg",
	}
	body, _ = json.Marshal(validPayload)
	req = httptest.NewRequest("POST", "/api/upload/presigned-url", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	server.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]interface{}
	json.NewDecoder(w.Body).Decode(&res)
	if res["upload_url"] == "" || res["file_url"] == "" {
		t.Fatalf("expected non-empty upload_url and file_url, got %+v", res)
	}
}
