package service

import (
	"context"
	"feetwork/internal/calories"
	"feetwork/internal/domain"
	"feetwork/internal/repository"
	"feetwork/internal/stats"
	"github.com/google/uuid"
	"math"
	"sort"
	"strings"
	"time"
)

type Service struct{ Store repository.Store }

func validNumber(v, min, max float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= min && v <= max
}
func (s *Service) Exercises(ctx context.Context) ([]domain.Exercise, error) {
	return s.Store.Exercises(ctx)
}
func (s *Service) Exercise(ctx context.Context, id string) (domain.Exercise, error) {
	return s.Store.Exercise(ctx, id)
}
func (s *Service) Templates(ctx context.Context) ([]domain.Template, error) {
	return s.Store.Templates(ctx, domain.DemoUserID)
}
func (s *Service) Template(ctx context.Context, id string) (domain.Template, error) {
	return s.Store.Template(ctx, domain.DemoUserID, id)
}
func (s *Service) SaveTemplate(ctx context.Context, id string, t domain.Template) (domain.Template, error) {
	t.Name = strings.TrimSpace(t.Name)
	if len([]rune(t.Name)) < 1 || len([]rune(t.Name)) > 120 || len([]rune(t.Description)) > 2000 {
		return t, domain.Invalid("Название: 1–120 символов, описание: до 2000")
	}
	if len(t.Exercises) < 1 || len(t.Exercises) > 30 {
		return t, domain.Invalid("Программа должна содержать 1–30 упражнений")
	}
	seen := map[string]bool{}
	for _, e := range t.Exercises {
		if _, err := uuid.Parse(e.ExerciseID); err != nil {
			return t, domain.Invalid("Некорректный ID упражнения")
		}
		if seen[e.ExerciseID] {
			return t, domain.Invalid("Упражнение уже добавлено")
		}
		seen[e.ExerciseID] = true
		if e.TargetSets < 1 || e.TargetSets > 20 || e.TargetRepsMin < 1 || e.TargetRepsMax < e.TargetRepsMin || e.TargetRepsMax > 100 || e.RestSeconds < 0 || e.RestSeconds > 900 {
			return t, domain.Invalid("Проверьте подходы (1–20), повторы (1–100) и отдых (0–900 с)")
		}
	}
	return s.Store.SaveTemplate(ctx, domain.DemoUserID, id, t)
}
func (s *Service) DeleteTemplate(ctx context.Context, id string) error {
	return s.Store.DeleteTemplate(ctx, domain.DemoUserID, id)
}
func decorate(result domain.Session, err error) (domain.Session, error) {
	if err == nil {
		result.Summary = stats.Summarize(result, time.Now())
	}
	return result, err
}
func (s *Service) Start(ctx context.Context, id string) (domain.Session, error) {
	if _, err := uuid.Parse(id); err != nil {
		return domain.Session{}, domain.Invalid("Укажите программу")
	}
	return decorate(s.Store.Start(ctx, domain.DemoUserID, id))
}
func (s *Service) Session(ctx context.Context, id string) (domain.Session, error) {
	return decorate(s.Store.Session(ctx, domain.DemoUserID, id))
}
func (s *Service) Active(ctx context.Context) (*domain.Session, error) {
	result, err := s.Store.Active(ctx, domain.DemoUserID)
	if err == nil && result != nil {
		result.Summary = stats.Summarize(*result, time.Now())
	}
	return result, err
}
func (s *Service) PatchSession(ctx context.Context, id string, p domain.SessionPatch) (domain.Session, error) {
	if p.Notes != nil && len([]rune(*p.Notes)) > 4000 {
		return domain.Session{}, domain.Invalid("Заметка: максимум 4000 символов")
	}
	if p.BodyWeightKg != nil && !validNumber(*p.BodyWeightKg, 20, 500) {
		return domain.Session{}, domain.Invalid("Масса тела: 20–500 кг")
	}
	return decorate(s.Store.PatchSession(ctx, domain.DemoUserID, id, p))
}
func validateSet(p domain.SetPatch) error {
	if p.WeightKg != nil && !validNumber(*p.WeightKg, 0, 1000) {
		return domain.Invalid("Вес: 0–1000 кг")
	}
	if p.Reps != nil && (*p.Reps < 1 || *p.Reps > 100) {
		return domain.Invalid("Повторы: 1–100")
	}
	if p.RIR.Value != nil && !validNumber(*p.RIR.Value, 0, 10) {
		return domain.Invalid("RIR: 0–10")
	}
	if p.RPE.Value != nil && !validNumber(*p.RPE.Value, 1, 10) {
		return domain.Invalid("RPE: 1–10")
	}
	if p.Notes != nil && len([]rune(*p.Notes)) > 2000 {
		return domain.Invalid("Заметка: максимум 2000 символов")
	}
	return nil
}
func (s *Service) PatchSet(ctx context.Context, id string, p domain.SetPatch) (domain.Set, error) {
	if err := validateSet(p); err != nil {
		return domain.Set{}, err
	}
	return s.Store.PatchSet(ctx, domain.DemoUserID, id, p)
}
func (s *Service) AddSet(ctx context.Context, exerciseID, id string) (domain.Set, error) {
	if id != "" {
		if _, err := uuid.Parse(id); err != nil {
			return domain.Set{}, domain.Invalid("Некорректный ID подхода")
		}
	}
	return s.Store.AddSet(ctx, domain.DemoUserID, exerciseID, id)
}
func (s *Service) DeleteSet(ctx context.Context, id string) error {
	return s.Store.DeleteSet(ctx, domain.DemoUserID, id)
}

type best struct {
	weight float64
	oneRM  float64
	reps   map[float64]int
}

func recordsFor(sessions []domain.Session) map[string]*best {
	out := map[string]*best{}
	for _, s := range sessions {
		for _, e := range s.Exercises {
			b := out[e.ExerciseID]
			if b == nil {
				b = &best{reps: map[float64]int{}}
				out[e.ExerciseID] = b
			}
			for _, set := range e.Sets {
				if !set.Completed {
					continue
				}
				b.weight = math.Max(b.weight, set.WeightKg)
				b.oneRM = math.Max(b.oneRM, stats.Epley(set.WeightKg, set.Reps))
				b.reps[set.WeightKg] = max(b.reps[set.WeightKg], set.Reps)
			}
		}
	}
	return out
}
func (s *Service) Finish(ctx context.Context, id string) (domain.Session, error) {
	return decorate(s.Store.Finish(ctx, domain.DemoUserID, id, func(current domain.Session, past []domain.Session) (float64, []domain.Record) {
		records := []domain.Record{}
		before := recordsFor(past)
		after := recordsFor([]domain.Session{current})
		for _, e := range current.Exercises {
			a := after[e.ExerciseID]
			b := before[e.ExerciseID]
			if b == nil {
				b = &best{reps: map[float64]int{}}
			}
			if a.weight > b.weight {
				records = append(records, domain.Record{ExerciseID: e.ExerciseID, ExerciseName: e.Exercise.Name, Kind: "max_weight", Value: a.weight, Previous: b.weight})
			}
			if a.oneRM > b.oneRM {
				records = append(records, domain.Record{ExerciseID: e.ExerciseID, ExerciseName: e.Exercise.Name, Kind: "estimated_1rm", Value: a.oneRM, Previous: b.oneRM})
			}
			weights := []float64{}
			for w := range a.reps {
				weights = append(weights, w)
			}
			sort.Float64s(weights)
			for _, w := range weights {
				r := a.reps[w]
				if previous, exists := b.reps[w]; exists && r > previous {
					records = append(records, domain.Record{ExerciseID: e.ExerciseID, ExerciseName: e.Exercise.Name, Kind: "reps_at_weight", Value: float64(r), Previous: float64(previous), WeightKg: w})
				}
			}
		}
		return calories.Calculate(current, *current.FinishedAt).Calories, records
	}))
}
func (s *Service) History(ctx context.Context, f repository.Filter) (domain.History, error) {
	return s.Store.History(ctx, domain.DemoUserID, f)
}
func (s *Service) Previous(ctx context.Context, id string) (domain.Previous, error) {
	if _, err := s.Store.Exercise(ctx, id); err != nil {
		return domain.Previous{}, err
	}
	return s.Store.Previous(ctx, domain.DemoUserID, id)
}
func addSummary(a *domain.Summary, b domain.Summary) {
	a.TrainingCount += b.TrainingCount
	a.TrainingDuration += b.TrainingDuration
	a.SetCount += b.SetCount
	a.TotalVolume += b.TotalVolume
	a.EstimatedCalories += b.EstimatedCalories
	a.CaloriesLow += b.CaloriesLow
	a.CaloriesHigh += b.CaloriesHigh
}
func (s *Service) Overview(ctx context.Context, f repository.Filter) (domain.Overview, error) {
	out := domain.Overview{Weeks: []domain.Period{}, Months: []domain.Period{}}
	sessions, err := s.Store.Finished(ctx, domain.DemoUserID, f)
	if err != nil {
		return out, err
	}
	weeks := map[string]*domain.Summary{}
	months := map[string]*domain.Summary{}
	for _, session := range sessions {
		summary := stats.Summarize(session, time.Now())
		addSummary(&out.Summary, summary)
		date := session.StartedAt.UTC()
		offset := (int(date.Weekday()) + 6) % 7
		week := date.AddDate(0, 0, -offset).Format("2006-01-02")
		month := date.Format("2006-01") + "-01"
		if weeks[week] == nil {
			weeks[week] = &domain.Summary{}
		}
		if months[month] == nil {
			months[month] = &domain.Summary{}
		}
		addSummary(weeks[week], summary)
		addSummary(months[month], summary)
	}
	for date, sum := range weeks {
		out.Weeks = append(out.Weeks, domain.Period{Date: date, Summary: *sum})
	}
	for date, sum := range months {
		out.Months = append(out.Months, domain.Period{Date: date, Summary: *sum})
	}
	sort.Slice(out.Weeks, func(i, j int) bool { return out.Weeks[i].Date < out.Weeks[j].Date })
	sort.Slice(out.Months, func(i, j int) bool { return out.Months[i].Date < out.Months[j].Date })
	return out, nil
}
func (s *Service) ExerciseStats(ctx context.Context, id string) (domain.ExerciseStats, error) {
	out := domain.ExerciseStats{Series: []domain.ExercisePoint{}, BestReps: []domain.RepsRecord{}, EstimateNote: "Epley — приблизительная оценка для 1–15 повторений. После 10 повторений погрешность выше; после 15 оценка не рассчитывается."}
	if _, err := s.Store.Exercise(ctx, id); err != nil {
		return out, err
	}
	sessions, err := s.Store.Finished(ctx, domain.DemoUserID, repository.Filter{})
	if err != nil {
		return out, err
	}
	points := map[string]*domain.ExercisePoint{}
	reps := map[float64]int{}
	month := time.Now().UTC().Format("2006-01")
	var previousMax, currentMax float64
	for _, session := range sessions {
		for _, e := range session.Exercises {
			if e.ExerciseID != id {
				continue
			}
			date := session.StartedAt.UTC().Format("2006-01-02")
			for _, set := range e.Sets {
				if !set.Completed {
					continue
				}
				if points[date] == nil {
					points[date] = &domain.ExercisePoint{Date: date}
				}
				p := points[date]
				p.MaxWeight = math.Max(p.MaxWeight, set.WeightKg)
				p.Volume += set.WeightKg * float64(set.Reps)
				p.Estimated1RM = math.Max(p.Estimated1RM, stats.Epley(set.WeightKg, set.Reps))
				reps[set.WeightKg] = max(reps[set.WeightKg], set.Reps)
				if date[:7] < month {
					previousMax = math.Max(previousMax, set.WeightKg)
				} else if date[:7] == month {
					currentMax = math.Max(currentMax, set.WeightKg)
				}
			}
		}
	}
	for _, p := range points {
		out.Series = append(out.Series, *p)
		out.MaxWeight = math.Max(out.MaxWeight, p.MaxWeight)
		out.Estimated1RM = math.Max(out.Estimated1RM, p.Estimated1RM)
	}
	sort.Slice(out.Series, func(i, j int) bool { return out.Series[i].Date < out.Series[j].Date })
	for w, r := range reps {
		out.BestReps = append(out.BestReps, domain.RepsRecord{WeightKg: w, Reps: r})
	}
	sort.Slice(out.BestReps, func(i, j int) bool { return out.BestReps[i].WeightKg > out.BestReps[j].WeightKg })
	if previousMax > 0 && currentMax > 0 {
		out.MonthlyWeightChange = currentMax - previousMax
	}
	return out, nil
}
func (s *Service) BodyWeights(ctx context.Context) ([]domain.BodyWeight, error) {
	return s.Store.BodyWeights(ctx, domain.DemoUserID)
}
func (s *Service) AddBodyWeight(ctx context.Context, weight float64, at *time.Time) (domain.BodyWeight, error) {
	if !validNumber(weight, 20, 500) {
		return domain.BodyWeight{}, domain.Invalid("Масса тела: 20–500 кг")
	}
	measured := time.Now().UTC()
	if at != nil {
		measured = *at
	}
	if measured.After(time.Now().Add(time.Minute)) || measured.Before(time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)) {
		return domain.BodyWeight{}, domain.Invalid("Некорректная дата измерения")
	}
	return s.Store.AddBodyWeight(ctx, domain.DemoUserID, weight, measured)
}
func (s *Service) Profile(ctx context.Context) (domain.Profile, error) {
	return s.Store.Profile(ctx, domain.DemoUserID)
}
