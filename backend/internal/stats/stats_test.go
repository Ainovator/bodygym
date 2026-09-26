package stats

import (
	"math"
	"testing"
)

func TestEpley(t *testing.T) {
	for _, tt := range []struct {
		w    float64
		r    int
		want float64
	}{{80, 10, 106.6666667}, {100, 1, 103.3333333}, {80, 30, 0}, {0, 10, 0}, {80, 0, 0}, {-1, 10, 0}, {math.NaN(), 10, 0}, {60, 15, 90}} {
		if got := Epley(tt.w, tt.r); math.Abs(got-tt.want) > .0001 {
			t.Errorf("Epley(%v,%d)=%v want %v", tt.w, tt.r, got, tt.want)
		}
	}
}
