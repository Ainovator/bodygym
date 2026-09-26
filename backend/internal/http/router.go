package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"feetwork/internal/domain"
	"feetwork/internal/repository"
	"feetwork/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type handler func(http.ResponseWriter, *http.Request) (any, error)

func Router(s *service.Service, origins []string, log *slog.Logger) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Cache-Control", "no-store")
			next.ServeHTTP(ww, r)
			log.Info("request", "method", r.Method, "path", r.URL.Path, "status", ww.Status(), "duration_ms", time.Since(start).Milliseconds(), "request_id", middleware.GetReqID(r.Context()))
		})
	})
	r.Use(cors.Handler(cors.Options{AllowedOrigins: origins, AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}, AllowedHeaders: []string{"Accept", "Content-Type"}, MaxAge: 300}))
	r.Use(middleware.Timeout(30 * time.Second))
	wrap := func(status int, fn handler) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			for _, key := range []string{"id"} {
				if id := chi.URLParam(r, key); id != "" {
					if _, err := uuid.Parse(id); err != nil {
						writeError(w, r, domain.Invalid("Некорректный UUID"), log)
						return
					}
				}
			}
			value, err := fn(w, r)
			if err != nil {
				writeError(w, r, err, log)
				return
			}
			if status == 204 {
				w.WriteHeader(status)
				return
			}
			writeJSON(w, status, value)
		}
	}
	r.Get("/healthz", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		return map[string]string{"status": "ok"}, nil
	}))
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.Store.Ping(r.Context()); err != nil {
			writeJSON(w, 503, map[string]string{"status": "unavailable"})
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ready"})
	})
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/me", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) { return s.Profile(r.Context()) }))
		r.Get("/exercises", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) { return s.Exercises(r.Context()) }))
		r.Get("/exercises/{id}", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return s.Exercise(r.Context(), chi.URLParam(r, "id"))
		}))
		r.Get("/exercises/{id}/previous", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return s.Previous(r.Context(), chi.URLParam(r, "id"))
		}))
		r.Get("/workout-templates", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) { return s.Templates(r.Context()) }))
		r.Get("/workout-templates/{id}", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return s.Template(r.Context(), chi.URLParam(r, "id"))
		}))
		saveTemplate := func(w http.ResponseWriter, r *http.Request) (any, error) {
			var body domain.Template
			if err := decode(w, r, &body); err != nil {
				return nil, err
			}
			return s.SaveTemplate(r.Context(), chi.URLParam(r, "id"), body)
		}
		r.Post("/workout-templates", wrap(201, saveTemplate))
		r.Put("/workout-templates/{id}", wrap(200, saveTemplate))
		r.Delete("/workout-templates/{id}", wrap(204, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return nil, s.DeleteTemplate(r.Context(), chi.URLParam(r, "id"))
		}))
		r.Post("/workouts/start", wrap(201, func(w http.ResponseWriter, r *http.Request) (any, error) {
			var body struct {
				TemplateID string `json:"template_id"`
			}
			if err := decode(w, r, &body); err != nil {
				return nil, err
			}
			return s.Start(r.Context(), body.TemplateID)
		}))
		r.Get("/workouts/active", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) { return s.Active(r.Context()) }))
		r.Get("/workouts/{id}", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return s.Session(r.Context(), chi.URLParam(r, "id"))
		}))
		r.Patch("/workouts/{id}", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			var body domain.SessionPatch
			if err := decode(w, r, &body); err != nil {
				return nil, err
			}
			return s.PatchSession(r.Context(), chi.URLParam(r, "id"), body)
		}))
		r.Post("/workouts/{id}/finish", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return s.Finish(r.Context(), chi.URLParam(r, "id"))
		}))
		r.Patch("/sets/{id}", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			var body domain.SetPatch
			if err := decode(w, r, &body); err != nil {
				return nil, err
			}
			return s.PatchSet(r.Context(), chi.URLParam(r, "id"), body)
		}))
		r.Post("/session-exercises/{id}/sets", wrap(201, func(w http.ResponseWriter, r *http.Request) (any, error) {
			var body struct {
				ID string `json:"id"`
			}
			if err := decode(w, r, &body); err != nil {
				return nil, err
			}
			return s.AddSet(r.Context(), chi.URLParam(r, "id"), body.ID)
		}))
		r.Delete("/sets/{id}", wrap(204, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return nil, s.DeleteSet(r.Context(), chi.URLParam(r, "id"))
		}))
		r.Get("/history", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			f, err := filter(r)
			if err != nil {
				return nil, err
			}
			return s.History(r.Context(), f)
		}))
		r.Get("/stats/overview", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			f, err := filter(r)
			if err != nil {
				return nil, err
			}
			return s.Overview(r.Context(), f)
		}))
		r.Get("/stats/exercises/{id}", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) {
			return s.ExerciseStats(r.Context(), chi.URLParam(r, "id"))
		}))
		r.Get("/stats/body-weight", wrap(200, func(w http.ResponseWriter, r *http.Request) (any, error) { return s.BodyWeights(r.Context()) }))
		r.Post("/body-weight", wrap(201, func(w http.ResponseWriter, r *http.Request) (any, error) {
			var body struct {
				WeightKg   float64    `json:"weight_kg"`
				MeasuredAt *time.Time `json:"measured_at"`
			}
			if err := decode(w, r, &body); err != nil {
				return nil, err
			}
			return s.AddBodyWeight(r.Context(), body.WeightKg, body.MeasuredAt)
		}))
	})
	r.NotFound(func(w http.ResponseWriter, r *http.Request) { writeError(w, r, domain.ErrNotFound, log) })
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 405, map[string]any{"error": map[string]string{"code": "method_not_allowed", "message": "Метод не поддерживается"}})
	})
	return r
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func writeError(w http.ResponseWriter, r *http.Request, err error, log *slog.Logger) {
	status, code, message := 500, "internal_error", "Не удалось выполнить запрос"
	var validation domain.ValidationError
	var requestErr requestError
	switch {
	case errors.As(err, &requestErr):
		status, code, message = requestErr.Status, requestErr.Code, requestErr.Message
	case errors.As(err, &validation):
		status, code, message = 422, "validation_error", validation.Message
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "not_found", "Запись не найдена"
	case errors.Is(err, domain.ErrConflict):
		status, code, message = 409, "workout_finished", "Тренировка уже завершена"
	default:
		log.Error("request failed", "error", err, "request_id", middleware.GetReqID(r.Context()))
	}
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message, "request_id": middleware.GetReqID(r.Context())}})
}

type requestError struct {
	Status  int
	Code    string
	Message string
}

func (e requestError) Error() string { return e.Message }
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		return requestError{415, "unsupported_media_type", "Ожидается Content-Type: application/json"}
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			return requestError{413, "body_too_large", "Максимальный размер запроса: 1 МБ"}
		}
		return requestError{400, "invalid_json", "Не удалось прочитать запрос"}
	}
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || raw[0] != '{' {
		return requestError{400, "invalid_json", "Ожидается JSON объект"}
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return requestError{400, "invalid_json", "Некорректный JSON или неизвестное поле"}
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		return requestError{400, "invalid_json", "Ожидается один JSON объект"}
	}
	return nil
}
func filter(r *http.Request) (repository.Filter, error) {
	f := repository.Filter{Page: 1, Limit: 20}
	q := r.URL.Query()
	for key, target := range map[string]*int{"page": &f.Page, "limit": &f.Limit} {
		if value := q.Get(key); value != "" {
			n, err := strconv.Atoi(value)
			if err != nil || n < 1 || n > 100000 || (key == "limit" && n > 100) {
				return f, domain.Invalid("Некорректная пагинация")
			}
			*target = n
		}
	}
	for key, target := range map[string]**time.Time{"from": &f.From, "to": &f.To} {
		if value := q.Get(key); value != "" {
			layout := time.RFC3339
			if !strings.Contains(value, "T") {
				layout = "2006-01-02"
			}
			date, err := time.Parse(layout, value)
			if err != nil {
				return f, domain.Invalid("Дата: YYYY-MM-DD или RFC3339")
			}
			if key == "to" && layout == "2006-01-02" {
				date = date.AddDate(0, 0, 1)
			}
			*target = &date
		}
	}
	if f.From != nil && f.To != nil && !f.To.After(*f.From) {
		return f, domain.Invalid("Конец периода должен быть после начала")
	}
	return f, nil
}
