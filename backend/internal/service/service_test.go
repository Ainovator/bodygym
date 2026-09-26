package service

import (
	"feetwork/internal/domain"
	"testing"
)

func TestSetValidation(t *testing.T) {
	weight := -1.0
	reps := 101
	rpe := 11.0
	for _, p := range []domain.SetPatch{{WeightKg: &weight}, {Reps: &reps}, {RPE: domain.Optional[float64]{Present: true, Value: &rpe}}} {
		if validateSet(p) == nil {
			t.Fatal("invalid patch accepted")
		}
	}
	if validateSet(domain.SetPatch{RPE: domain.Optional[float64]{Present: true}}) != nil {
		t.Fatal("null RPE must clear value")
	}
}
