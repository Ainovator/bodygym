package calories

import (
	"feetwork/internal/domain"
	"math"
	"time"
)

type Estimate struct {
	Calories      float64
	Low           float64
	High          float64
	ActiveSeconds float64
	RestSeconds   float64
}

func Multiplier(rpe *float64) float64 {
	if rpe == nil {
		return 1
	}
	if *rpe <= 5 {
		return .90
	}
	if *rpe <= 7 {
		return 1
	}
	if *rpe < 10 {
		return 1.10
	}
	return 1.15
}
func Calculate(s domain.Session, end time.Time) Estimate {
	duration := math.Max(0, end.Sub(s.StartedAt).Seconds())
	if s.BodyWeightKg <= 0 || math.IsNaN(s.BodyWeightKg) || math.IsInf(s.BodyWeightKg, 0) {
		return Estimate{}
	}
	active, metSeconds := 0.0, 0.0
	for _, ex := range s.Exercises {
		for _, set := range ex.Sets {
			if !set.Completed {
				continue
			}
			seconds := float64(set.Reps)*3 + 10
			if set.StartedAt != nil && set.CompletedAt != nil && set.CompletedAt.After(*set.StartedAt) {
				start := *set.StartedAt
				finish := *set.CompletedAt
				if start.Before(s.StartedAt) {
					start = s.StartedAt
				}
				if finish.After(end) {
					finish = end
				}
				seconds = math.Max(0, finish.Sub(start).Seconds())
			}
			met := map[string]float64{"isolation": 4, "machine_compound": 4.5, "compound": 5.5, "high_intensity": 6}[ex.Exercise.CalorieClass]
			if met == 0 {
				met = 4
			}
			active += seconds
			metSeconds += seconds * met * Multiplier(set.RPE)
		}
	}
	// Estimated/overlapping active intervals must never exceed elapsed session time.
	if active > duration && active > 0 {
		metSeconds *= duration / active
		active = duration
	}
	rest := duration - active
	kcal := (metSeconds + rest*1.8) / 60 * 3.5 * s.BodyWeightKg / 200
	return Estimate{kcal, kcal * .7, kcal * 1.3, active, rest}
}
