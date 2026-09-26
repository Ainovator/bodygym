package repository

import (
	"context"
	"feetwork/internal/domain"
	"time"
)

type Filter struct {
	From  *time.Time
	To    *time.Time
	Page  int
	Limit int
}
type FinishCalculator func(domain.Session, []domain.Session) (float64, []domain.Record)

// Store is the persistence boundary; services can be tested without PostgreSQL.
type Store interface {
	Ping(context.Context) error
	Exercises(context.Context) ([]domain.Exercise, error)
	Exercise(context.Context, string) (domain.Exercise, error)
	Templates(context.Context, string) ([]domain.Template, error)
	Template(context.Context, string, string) (domain.Template, error)
	SaveTemplate(context.Context, string, string, domain.Template) (domain.Template, error)
	DeleteTemplate(context.Context, string, string) error
	Start(context.Context, string, string) (domain.Session, error)
	Session(context.Context, string, string) (domain.Session, error)
	Active(context.Context, string) (*domain.Session, error)
	PatchSession(context.Context, string, string, domain.SessionPatch) (domain.Session, error)
	Finish(context.Context, string, string, FinishCalculator) (domain.Session, error)
	PatchSet(context.Context, string, string, domain.SetPatch) (domain.Set, error)
	AddSet(context.Context, string, string, string) (domain.Set, error)
	DeleteSet(context.Context, string, string) error
	Finished(context.Context, string, Filter) ([]domain.Session, error)
	History(context.Context, string, Filter) (domain.History, error)
	Previous(context.Context, string, string) (domain.Previous, error)
	BodyWeights(context.Context, string) ([]domain.BodyWeight, error)
	AddBodyWeight(context.Context, string, float64, time.Time) (domain.BodyWeight, error)
	Profile(context.Context, string) (domain.Profile, error)
}
