package calories

import (
	"feetwork/internal/domain"
	"math"
	"testing"
	"time"
)

func TestCalculate(t *testing.T) {
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	rpe := 8.0
	s := domain.Session{StartedAt: start, BodyWeightKg: 80, Exercises: []domain.SessionExercise{{Exercise: domain.Exercise{CalorieClass: "compound"}, Sets: []domain.Set{{Reps: 10, Completed: true, RPE: &rpe}}}}}
	got := Calculate(s, start.Add(10*time.Minute))
	want := (40*5.5*1.1 + 560*1.8) / 60 * 3.5 * 80 / 200
	if math.Abs(got.Calories-want) > .0001 || got.ActiveSeconds != 40 || got.RestSeconds != 560 {
		t.Fatalf("unexpected estimate: %+v, want %v", got, want)
	}
	got = Calculate(s, start.Add(10*time.Second))
	if got.RestSeconds != 0 || got.ActiveSeconds != 10 {
		t.Fatal("duration not clamped", got)
	}
	s.Exercises[0].Sets[0].Completed = false
	got = Calculate(s, start.Add(time.Minute))
	if math.Abs(got.Calories-2.52) > .001 {
		t.Fatal("incomplete sets counted", got)
	}
	s.BodyWeightKg = 0
	if Calculate(s, start.Add(time.Minute)).Calories != 0 {
		t.Fatal("zero body weight")
	}
}
func TestMeasuredDurationAndMultipliers(t *testing.T) {
	now := time.Now()
	finish := now.Add(time.Minute)
	s := domain.Session{StartedAt: now, BodyWeightKg: 100, Exercises: []domain.SessionExercise{{Exercise: domain.Exercise{CalorieClass: "isolation"}, Sets: []domain.Set{{Completed: true, StartedAt: &now, CompletedAt: &finish}}}}}
	if got := Calculate(s, finish); math.Abs(got.Calories-7) > .001 {
		t.Fatal(got)
	}
	for _, tt := range []struct{ r, w float64 }{{5, .9}, {6, 1}, {7, 1}, {8, 1.1}, {9, 1.1}, {10, 1.15}} {
		if Multiplier(&tt.r) != tt.w {
			t.Fatal(tt)
		}
	}
	if Calculate(s, now.Add(-time.Second)).Calories != 0 {
		t.Fatal("negative duration")
	}
}
