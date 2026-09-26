package postgres

import (
	"context"
	"errors"
	"feetwork/internal/domain"
	"feetwork/internal/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"sync"
	"testing"
	"time"
)

func TestWorkoutTransactionIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to a migrated PostgreSQL 16 database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	store := &Store{Pool: pool}
	user := uuid.NewString()
	_, err = pool.Exec(ctx, `INSERT INTO users(id,name,weight_kg)VALUES($1,'Integration test',80)`, user)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, c := context.WithTimeout(context.Background(), 5*time.Second)
		defer c()
		if _, e := pool.Exec(cleanup, `DELETE FROM users WHERE id=$1`, user); e != nil {
			t.Error(e)
		}
	}()
	exercises, err := store.Exercises(ctx)
	if err != nil || len(exercises) < 20 {
		t.Fatalf("seed exercises: %d, %v", len(exercises), err)
	}
	template, err := store.SaveTemplate(ctx, user, "", domain.Template{Name: "Integration", Exercises: []domain.TemplateExercise{{ExerciseID: exercises[0].ID, TargetSets: 3, TargetRepsMin: 8, TargetRepsMax: 12, RestSeconds: 90}}})
	if err != nil {
		t.Fatal(err)
	}
	// An invalid FK rolls the whole template back, including its parent row.
	_, err = store.SaveTemplate(ctx, user, "", domain.Template{Name: "Rollback", Exercises: []domain.TemplateExercise{{ExerciseID: uuid.NewString(), TargetSets: 3, TargetRepsMin: 8, TargetRepsMax: 12, RestSeconds: 90}}})
	if err == nil {
		t.Fatal("invalid FK accepted")
	}
	templates, err := store.Templates(ctx, user)
	if err != nil || len(templates) != 1 {
		t.Fatalf("rollback failed: %d %v", len(templates), err)
	}
	var wg sync.WaitGroup
	ids := make(chan string, 8)
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			session, e := store.Start(ctx, user, template.ID)
			if e != nil {
				errs <- e
				return
			}
			ids <- session.ID
		}()
	}
	wg.Wait()
	close(ids)
	close(errs)
	for e := range errs {
		t.Error(e)
	}
	if t.Failed() {
		return
	}
	sessionID := ""
	for id := range ids {
		if sessionID != "" && sessionID != id {
			t.Fatal("concurrent starts created different sessions")
		}
		sessionID = id
	}
	session, err := store.Session(ctx, user, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if len(session.Exercises) != 1 || len(session.Exercises[0].Sets) != 3 {
		t.Fatal("planned sets were not copied")
	}
	set := session.Exercises[0].Sets[0]
	weight := 82.5
	reps := 10
	done := true
	rpe := 8.0
	set, err = store.PatchSet(ctx, user, set.ID, domain.SetPatch{WeightKg: &weight, Reps: &reps, Completed: &done, RPE: domain.Optional[float64]{Present: true, Value: &rpe}})
	if err != nil || !set.Completed || set.CompletedAt == nil {
		t.Fatalf("patch: %+v %v", set, err)
	}
	set, err = store.PatchSet(ctx, user, set.ID, domain.SetPatch{RPE: domain.Optional[float64]{Present: true}})
	if err != nil || set.RPE != nil {
		t.Fatal("nullable RPE did not clear", err)
	}
	_, err = store.PatchSet(ctx, uuid.NewString(), set.ID, domain.SetPatch{WeightKg: &weight})
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatal("cross-user mutation accepted", err)
	}
	addID := uuid.NewString()
	added, err := store.AddSet(ctx, user, session.Exercises[0].ID, addID)
	if err != nil {
		t.Fatal(err)
	}
	again, err := store.AddSet(ctx, user, session.Exercises[0].ID, addID)
	if err != nil || again.ID != added.ID {
		t.Fatal("add retry not idempotent", err)
	}
	if err = store.DeleteSet(ctx, user, added.ID); err != nil {
		t.Fatal(err)
	}
	finished, err := store.Finish(ctx, user, sessionID, func(domain.Session, []domain.Session) (float64, []domain.Record) { return 123, []domain.Record{} })
	if err != nil || finished.FinishedAt == nil {
		t.Fatal("finish", err)
	}
	_, err = store.Finish(ctx, user, sessionID, func(domain.Session, []domain.Session) (float64, []domain.Record) {
		t.Error("finish calculated twice")
		return 0, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.PatchSet(ctx, user, set.ID, domain.SetPatch{WeightKg: &weight})
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatal("finished workout mutated", err)
	}
	previous, err := store.Previous(ctx, user, exercises[0].ID)
	if err != nil || len(previous.Sets) != 1 || previous.Sets[0].WeightKg != 82.5 {
		t.Fatal("previous", err)
	}
	history, err := store.History(ctx, user, repository.Filter{Page: 1, Limit: 10})
	if err != nil || history.Total != 1 || history.Items[0].TotalVolume != 825 {
		t.Fatalf("history: %+v %v", history, err)
	}
	if err = store.DeleteTemplate(ctx, user, template.ID); err != nil {
		t.Fatal(err)
	}
	preserved, err := store.Session(ctx, user, sessionID)
	if err != nil || preserved.TemplateID != nil || len(preserved.Exercises) != 1 {
		t.Fatal("template deletion broke history", err)
	}
}
