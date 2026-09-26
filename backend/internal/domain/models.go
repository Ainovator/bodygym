package domain

import (
	"encoding/json"
	"errors"
	"time"
)

const DemoUserID = "11111111-1111-4111-8111-111111111111"

var ErrNotFound = errors.New("not found")
var ErrConflict = errors.New("workout is already finished")

type ValidationError struct{ Message string }

func (e ValidationError) Error() string { return e.Message }
func Invalid(s string) error            { return ValidationError{s} }

type Media struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	URL      string `json:"url"`
	Position int    `json:"position"`
}
type Exercise struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Slug               string   `json:"slug"`
	Description        string   `json:"description"`
	Instructions       []string `json:"instructions"`
	CommonMistakes     []string `json:"common_mistakes"`
	PrimaryMuscles     []string `json:"primary_muscles"`
	SecondaryMuscles   []string `json:"secondary_muscles"`
	Equipment          string   `json:"equipment"`
	Category           string   `json:"category"`
	CalorieClass       string   `json:"calorie_class"`
	DefaultRestSeconds int      `json:"default_rest_seconds"`
	Media              []Media  `json:"media"`
}
type TemplateExercise struct {
	ID            string   `json:"id"`
	ExerciseID    string   `json:"exercise_id"`
	Position      int      `json:"position"`
	TargetSets    int      `json:"target_sets"`
	TargetRepsMin int      `json:"target_reps_min"`
	TargetRepsMax int      `json:"target_reps_max"`
	RestSeconds   int      `json:"rest_seconds"`
	Exercise      Exercise `json:"exercise"`
}
type Template struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Exercises   []TemplateExercise `json:"exercises"`
}
type Set struct {
	ID                string     `json:"id"`
	SessionExerciseID string     `json:"session_exercise_id"`
	SetNumber         int        `json:"set_number"`
	WeightKg          float64    `json:"weight_kg"`
	Reps              int        `json:"reps"`
	RIR               *float64   `json:"rir"`
	RPE               *float64   `json:"rpe"`
	Completed         bool       `json:"completed"`
	StartedAt         *time.Time `json:"started_at"`
	CompletedAt       *time.Time `json:"completed_at"`
	Notes             string     `json:"notes"`
}
type SessionExercise struct {
	ID            string   `json:"id"`
	ExerciseID    string   `json:"exercise_id"`
	Position      int      `json:"position"`
	TargetRepsMin int      `json:"target_reps_min"`
	TargetRepsMax int      `json:"target_reps_max"`
	RestSeconds   int      `json:"rest_seconds"`
	Exercise      Exercise `json:"exercise"`
	Sets          []Set    `json:"sets"`
}
type Record struct {
	ExerciseID   string  `json:"exercise_id"`
	ExerciseName string  `json:"exercise_name"`
	Kind         string  `json:"kind"`
	Value        float64 `json:"value"`
	Previous     float64 `json:"previous"`
	WeightKg     float64 `json:"weight_kg,omitempty"`
}
type Session struct {
	ID                string            `json:"id"`
	TemplateID        *string           `json:"template_id"`
	Name              string            `json:"name"`
	StartedAt         time.Time         `json:"started_at"`
	FinishedAt        *time.Time        `json:"finished_at"`
	BodyWeightKg      float64           `json:"body_weight_kg"`
	EstimatedCalories float64           `json:"estimated_calories"`
	Notes             string            `json:"notes"`
	PersonalRecords   []Record          `json:"personal_records"`
	Exercises         []SessionExercise `json:"exercises"`
	Summary           Summary           `json:"summary"`
}
type Summary struct {
	TrainingCount     int     `json:"training_count"`
	TrainingDuration  float64 `json:"training_duration"`
	SetCount          int     `json:"set_count"`
	TotalVolume       float64 `json:"total_volume"`
	EstimatedCalories float64 `json:"estimated_calories"`
	CaloriesLow       float64 `json:"calories_low"`
	CaloriesHigh      float64 `json:"calories_high"`
}
type HistoryItem struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`
	Summary
}
type History struct {
	Items []HistoryItem `json:"items"`
	Total int           `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
}
type Period struct {
	Date string `json:"date"`
	Summary
}
type Overview struct {
	Summary
	Weeks  []Period `json:"weeks"`
	Months []Period `json:"months"`
}
type ExercisePoint struct {
	Date         string  `json:"date"`
	MaxWeight    float64 `json:"max_weight"`
	Volume       float64 `json:"volume"`
	Estimated1RM float64 `json:"estimated_1rm"`
}
type RepsRecord struct {
	WeightKg float64 `json:"weight_kg"`
	Reps     int     `json:"reps"`
}
type ExerciseStats struct {
	MaxWeight           float64         `json:"max_weight"`
	Estimated1RM        float64         `json:"estimated_1rm"`
	BestReps            []RepsRecord    `json:"best_reps_at_weight"`
	Series              []ExercisePoint `json:"series"`
	MonthlyWeightChange float64         `json:"monthly_weight_change"`
	EstimateNote        string          `json:"estimate_note"`
}
type Previous struct {
	Date *time.Time `json:"date"`
	Sets []Set      `json:"sets"`
}
type BodyWeight struct {
	ID         string    `json:"id"`
	WeightKg   float64   `json:"weight_kg"`
	MeasuredAt time.Time `json:"measured_at"`
}
type Profile struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	WeightKg float64 `json:"weight_kg"`
}
type Optional[T any] struct {
	Present bool
	Value   *T
}

func (o *Optional[T]) UnmarshalJSON(b []byte) error {
	o.Present = true
	return json.Unmarshal(b, &o.Value)
}

type SetPatch struct {
	WeightKg  *float64          `json:"weight_kg"`
	Reps      *int              `json:"reps"`
	RIR       Optional[float64] `json:"rir"`
	RPE       Optional[float64] `json:"rpe"`
	Completed *bool             `json:"completed"`
	StartedAt *time.Time        `json:"started_at"`
	Notes     *string           `json:"notes"`
}
type SessionPatch struct {
	Notes        *string  `json:"notes"`
	BodyWeightKg *float64 `json:"body_weight_kg"`
}
