package stats

import (
	"feetwork/internal/domain"
	"math"
	"time"
)

// Epley is a rough estimate. Outside 1–15 reps, omit it rather than extrapolate.
func Epley(weight float64, reps int) float64 {
	if weight <= 0 || math.IsNaN(weight) || math.IsInf(weight, 0) || reps < 1 || reps > 15 {
		return 0
	}
	return weight * (1 + float64(reps)/30)
}
func Summarize(s domain.Session, now time.Time) domain.Summary {
	end := now
	if s.FinishedAt != nil {
		end = *s.FinishedAt
	}
	out := domain.Summary{TrainingCount: 1, TrainingDuration: math.Max(0, end.Sub(s.StartedAt).Seconds()), EstimatedCalories: s.EstimatedCalories, CaloriesLow: s.EstimatedCalories * .7, CaloriesHigh: s.EstimatedCalories * 1.3}
	for _, e := range s.Exercises {
		for _, set := range e.Sets {
			if set.Completed {
				out.SetCount++
				out.TotalVolume += set.WeightKg * float64(set.Reps)
			}
		}
	}
	return out
}
