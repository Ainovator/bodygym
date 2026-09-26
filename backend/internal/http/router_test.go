package httpapi

import (
	"feetwork/internal/domain"
	"feetwork/internal/service"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInvalidUUIDReturnsStructuredError(t *testing.T) {
	router := Router(&service.Service{}, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	for _, path := range []string{"/api/v1/exercises/not-a-uuid", "/api/v1/workouts/not-a-uuid", "/api/v1/sets/not-a-uuid"} {
		method := "GET"
		if strings.Contains(path, "/sets/") {
			method = "PATCH"
		}
		r := httptest.NewRequest(method, path, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		if w.Code != 422 || !strings.Contains(w.Body.String(), "validation_error") {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
	}
}
func TestFilter(t *testing.T) {
	f, err := filter(httptest.NewRequest(http.MethodGet, "/history?page=2&limit=5&from=2026-09-01&to=2026-09-26", nil))
	if err != nil || f.Page != 2 || f.Limit != 5 || f.To.Format("2006-01-02") != "2026-09-27" {
		t.Fatal(f, err)
	}
	for _, query := range []string{"?page=-1", "?limit=101", "?from=bad", "?from=2026-10-01&to=2026-09-01"} {
		if _, err := filter(httptest.NewRequest(http.MethodGet, "/history"+query, nil)); err == nil {
			t.Fatal(query)
		}
	}
}
func TestStrictJSON(t *testing.T) {
	for _, body := range []string{`{"weight_kg":5,"unknown":true}`, `{} {}`, `{"reps":"ten"}`} {
		r := httptest.NewRequest("PATCH", "/", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if decode(httptest.NewRecorder(), r, &domain.SetPatch{}) == nil {
			t.Fatal(body)
		}
	}
}
