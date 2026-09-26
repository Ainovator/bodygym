package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"feetwork/internal/domain"
	"feetwork/internal/repository"
	"fmt"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type Store struct{ Pool *pgxpool.Pool }

var _ repository.Store = (*Store)(nil)

type queryer interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (s *Store) Ping(ctx context.Context) error { return s.Pool.Ping(ctx) }
func dbError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		switch pg.Code {
		case "23503", "23514", "22P02":
			return domain.Invalid("Некорректные данные или упражнение не существует")
		case "23505":
			return domain.Invalid("Конфликт: такая запись уже существует")
		}
	}
	return err
}
func readJSON[T any](ctx context.Context, q queryer, sql string, args ...any) (T, error) {
	var result T
	var data []byte
	if err := q.QueryRow(ctx, sql, args...).Scan(&data); err != nil {
		return result, dbError(err)
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return result, fmt.Errorf("decode database result: %w", err)
	}
	return result, nil
}

const exJSON = `to_jsonb(e) || jsonb_build_object('media',COALESCE((SELECT jsonb_agg(m ORDER BY m.position) FROM exercise_media m WHERE m.exercise_id=e.id),'[]'))`
const templateJSON = `to_jsonb(t) || jsonb_build_object('exercises',COALESCE((SELECT jsonb_agg(to_jsonb(te) || jsonb_build_object('exercise',` + exJSON + `) ORDER BY te.position) FROM workout_template_exercises te JOIN exercises e ON e.id=te.exercise_id WHERE te.template_id=t.id),'[]'))`
const sessionJSON = `to_jsonb(s) || jsonb_build_object('exercises',COALESCE((SELECT jsonb_agg(to_jsonb(se) || jsonb_build_object('exercise',` + exJSON + `,'sets',COALESCE((SELECT jsonb_agg(ws ORDER BY ws.set_number) FROM workout_sets ws WHERE ws.session_exercise_id=se.id),'[]')) ORDER BY se.position) FROM workout_session_exercises se JOIN exercises e ON e.id=se.exercise_id WHERE se.session_id=s.id),'[]'))`

func (s *Store) Exercises(ctx context.Context) ([]domain.Exercise, error) {
	return readJSON[[]domain.Exercise](ctx, s.Pool, `SELECT COALESCE(jsonb_agg(x ORDER BY x->>'name'),'[]') FROM (SELECT `+exJSON+` AS x FROM exercises e) z`)
}
func (s *Store) Exercise(ctx context.Context, id string) (domain.Exercise, error) {
	return readJSON[domain.Exercise](ctx, s.Pool, `SELECT `+exJSON+` FROM exercises e WHERE e.id=$1`, id)
}
func (s *Store) Templates(ctx context.Context, user string) ([]domain.Template, error) {
	return readJSON[[]domain.Template](ctx, s.Pool, `SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at'),'[]') FROM (SELECT `+templateJSON+` AS x FROM workout_templates t WHERE t.user_id=$1) z`, user)
}
func (s *Store) Template(ctx context.Context, user, id string) (domain.Template, error) {
	return readJSON[domain.Template](ctx, s.Pool, `SELECT `+templateJSON+` FROM workout_templates t WHERE t.user_id=$1 AND t.id=$2`, user, id)
}
func rollback(ctx context.Context, tx pgx.Tx) { _ = tx.Rollback(ctx) }
func (s *Store) SaveTemplate(ctx context.Context, user, id string, t domain.Template) (domain.Template, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return t, err
	}
	defer rollback(ctx, tx)
	if id == "" {
		err = tx.QueryRow(ctx, `INSERT INTO workout_templates(user_id,name,description) VALUES($1,$2,$3) RETURNING id`, user, t.Name, t.Description).Scan(&id)
	} else {
		tag, e := tx.Exec(ctx, `UPDATE workout_templates SET name=$3,description=$4,updated_at=now() WHERE user_id=$1 AND id=$2`, user, id, t.Name, t.Description)
		err = e
		if err == nil && tag.RowsAffected() == 0 {
			return t, domain.ErrNotFound
		}
		if err == nil {
			_, err = tx.Exec(ctx, `DELETE FROM workout_template_exercises WHERE template_id=$1`, id)
		}
	}
	if err != nil {
		return t, dbError(err)
	}
	for i, e := range t.Exercises {
		_, err = tx.Exec(ctx, `INSERT INTO workout_template_exercises(template_id,exercise_id,position,target_sets,target_reps_min,target_reps_max,rest_seconds) VALUES($1,$2,$3,$4,$5,$6,$7)`, id, e.ExerciseID, i, e.TargetSets, e.TargetRepsMin, e.TargetRepsMax, e.RestSeconds)
		if err != nil {
			return t, dbError(err)
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return t, err
	}
	return s.Template(ctx, user, id)
}
func (s *Store) DeleteTemplate(ctx context.Context, user, id string) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM workout_templates WHERE user_id=$1 AND id=$2`, user, id)
	if err != nil {
		return dbError(err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
func getSession(ctx context.Context, q queryer, user, id string) (domain.Session, error) {
	return readJSON[domain.Session](ctx, q, `SELECT `+sessionJSON+` FROM workout_sessions s WHERE s.user_id=$1 AND s.id=$2`, user, id)
}
func (s *Store) Session(ctx context.Context, user, id string) (domain.Session, error) {
	return getSession(ctx, s.Pool, user, id)
}
func (s *Store) Active(ctx context.Context, user string) (*domain.Session, error) {
	result, err := readJSON[domain.Session](ctx, s.Pool, `SELECT `+sessionJSON+` FROM workout_sessions s WHERE s.user_id=$1 AND s.finished_at IS NULL`, user)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
}
func (s *Store) Start(ctx context.Context, user, template string) (domain.Session, error) {
	var result domain.Session
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer rollback(ctx, tx)
	// Serializes starts even when clients retry after losing the response.
	var weight float64
	err = tx.QueryRow(ctx, `SELECT weight_kg FROM users WHERE id=$1 FOR UPDATE`, user).Scan(&weight)
	if err != nil {
		return result, dbError(err)
	}
	var id string
	err = tx.QueryRow(ctx, `SELECT id FROM workout_sessions WHERE user_id=$1 AND finished_at IS NULL`, user).Scan(&id)
	if err == nil {
		return getSession(ctx, tx, user, id)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	var name string
	err = tx.QueryRow(ctx, `SELECT name FROM workout_templates WHERE id=$1 AND user_id=$2 FOR SHARE`, template, user).Scan(&name)
	if err != nil {
		return result, dbError(err)
	}
	err = tx.QueryRow(ctx, `INSERT INTO workout_sessions(user_id,template_id,name,body_weight_kg) VALUES($1,$2,$3,$4) RETURNING id`, user, template, name, weight).Scan(&id)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO workout_session_exercises(session_id,exercise_id,position,target_reps_min,target_reps_max,rest_seconds) SELECT $1,exercise_id,position,target_reps_min,target_reps_max,rest_seconds FROM workout_template_exercises WHERE template_id=$2`, id, template)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO workout_sets(session_exercise_id,set_number,weight_kg,reps)
 SELECT se.id,n,COALESCE(prev.weight_kg,0),COALESCE(prev.reps,te.target_reps_min)
 FROM workout_session_exercises se JOIN workout_template_exercises te ON te.template_id=$2 AND te.position=se.position
 CROSS JOIN LATERAL generate_series(1,te.target_sets) n
 LEFT JOIN LATERAL (SELECT ws.weight_kg,ws.reps FROM workout_sets ws JOIN workout_session_exercises old ON old.id=ws.session_exercise_id JOIN workout_sessions os ON os.id=old.session_id WHERE old.exercise_id=se.exercise_id AND os.user_id=$3 AND os.finished_at IS NOT NULL AND ws.completed AND ws.set_number=n ORDER BY os.started_at DESC LIMIT 1) prev ON true
 WHERE se.session_id=$1`, id, template, user)
	if err != nil {
		return result, err
	}
	result, err = getSession(ctx, tx, user, id)
	if err != nil {
		return result, err
	}
	if err = tx.Commit(ctx); err != nil {
		return result, err
	}
	return result, nil
}
func lockSession(ctx context.Context, tx pgx.Tx, user, id string) (bool, error) {
	var finished bool
	err := tx.QueryRow(ctx, `SELECT finished_at IS NOT NULL FROM workout_sessions WHERE user_id=$1 AND id=$2 FOR UPDATE`, user, id).Scan(&finished)
	return finished, dbError(err)
}
func (s *Store) PatchSession(ctx context.Context, user, id string, p domain.SessionPatch) (domain.Session, error) {
	var result domain.Session
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer rollback(ctx, tx)
	finished, err := lockSession(ctx, tx, user, id)
	if err != nil {
		return result, err
	}
	if finished {
		return result, domain.ErrConflict
	}
	_, err = tx.Exec(ctx, `UPDATE workout_sessions SET notes=COALESCE($2,notes),body_weight_kg=COALESCE($3,body_weight_kg) WHERE id=$1`, id, p.Notes, p.BodyWeightKg)
	if err != nil {
		return result, dbError(err)
	}
	result, err = getSession(ctx, tx, user, id)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
func finishedSessions(ctx context.Context, q queryer, user string, f repository.Filter) ([]domain.Session, error) {
	return readJSON[[]domain.Session](ctx, q, `SELECT COALESCE(jsonb_agg(x ORDER BY x->>'started_at'),'[]') FROM (SELECT `+sessionJSON+` AS x FROM workout_sessions s WHERE s.user_id=$1 AND s.finished_at IS NOT NULL AND ($2::timestamptz IS NULL OR s.started_at >= $2) AND ($3::timestamptz IS NULL OR s.started_at < $3)) z`, user, f.From, f.To)
}
func (s *Store) Finished(ctx context.Context, user string, f repository.Filter) ([]domain.Session, error) {
	return finishedSessions(ctx, s.Pool, user, f)
}
func (s *Store) Finish(ctx context.Context, user, id string, calculate repository.FinishCalculator) (domain.Session, error) {
	var result domain.Session
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer rollback(ctx, tx)
	finished, err := lockSession(ctx, tx, user, id)
	if err != nil {
		return result, err
	}
	result, err = getSession(ctx, tx, user, id)
	if err != nil {
		return result, err
	}
	if finished {
		return result, nil
	}
	past, err := finishedSessions(ctx, tx, user, repository.Filter{})
	if err != nil {
		return result, err
	}
	now := time.Now().UTC()
	result.FinishedAt = &now
	kcal, records := calculate(result, past)
	data, err := json.Marshal(records)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `UPDATE workout_sessions SET finished_at=$2,estimated_calories=$3,personal_records=$4 WHERE id=$1`, id, now, kcal, data)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `UPDATE workout_session_exercises SET finished_at=$2 WHERE session_id=$1`, id, now)
	if err != nil {
		return result, err
	}
	result, err = getSession(ctx, tx, user, id)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
func lockSetParent(ctx context.Context, tx pgx.Tx, user, id string, exercise bool) (string, error) {
	sql := `SELECT se.session_id FROM workout_sets ws JOIN workout_session_exercises se ON se.id=ws.session_exercise_id WHERE ws.id=$1`
	if exercise {
		sql = `SELECT session_id FROM workout_session_exercises WHERE id=$1`
	}
	var sessionID string
	if err := tx.QueryRow(ctx, sql, id).Scan(&sessionID); err != nil {
		return "", dbError(err)
	}
	finished, err := lockSession(ctx, tx, user, sessionID)
	if err != nil {
		return "", err
	}
	if finished {
		return "", domain.ErrConflict
	}
	return sessionID, nil
}
func (s *Store) PatchSet(ctx context.Context, user, id string, p domain.SetPatch) (domain.Set, error) {
	var result domain.Set
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer rollback(ctx, tx)
	sessionID, err := lockSetParent(ctx, tx, user, id, false)
	if err != nil {
		return result, err
	}
	if p.StartedAt != nil {
		var start time.Time
		err = tx.QueryRow(ctx, `SELECT started_at FROM workout_sessions WHERE id=$1`, sessionID).Scan(&start)
		if err != nil {
			return result, err
		}
		if p.StartedAt.Before(start) || p.StartedAt.After(time.Now().Add(5*time.Second)) {
			return result, domain.Invalid("Время подхода вне тренировки")
		}
	}
	result, err = readJSON[domain.Set](ctx, tx, `UPDATE workout_sets SET weight_kg=COALESCE($2,weight_kg),reps=COALESCE($3,reps),rir=CASE WHEN $4 THEN $5 ELSE rir END,rpe=CASE WHEN $6 THEN $7 ELSE rpe END,
 completed=COALESCE($8,completed),started_at=COALESCE($9,started_at),notes=COALESCE($10,notes),
 completed_at=CASE WHEN $8=true THEN COALESCE(completed_at,clock_timestamp()) WHEN $8=false THEN NULL ELSE completed_at END
 WHERE id=$1 RETURNING to_jsonb(workout_sets)`, id, p.WeightKg, p.Reps, p.RIR.Present, p.RIR.Value, p.RPE.Present, p.RPE.Value, p.Completed, p.StartedAt, p.Notes)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `UPDATE workout_session_exercises SET started_at=COALESCE(started_at,now()) WHERE id=$1`, result.SessionExerciseID)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
func (s *Store) AddSet(ctx context.Context, user, exerciseID, id string) (domain.Set, error) {
	var result domain.Set
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer rollback(ctx, tx)
	_, err = lockSetParent(ctx, tx, user, exerciseID, true)
	if err != nil {
		return result, err
	}
	if id == "" {
		id = uuid.NewString()
	}
	existing, e := readJSON[domain.Set](ctx, tx, `SELECT to_jsonb(ws) FROM workout_sets ws WHERE id=$1 AND session_exercise_id=$2`, id, exerciseID)
	if e == nil {
		return existing, nil
	}
	if !errors.Is(e, domain.ErrNotFound) {
		return result, e
	}
	var count int
	err = tx.QueryRow(ctx, `SELECT count(*) FROM workout_sets WHERE session_exercise_id=$1`, exerciseID).Scan(&count)
	if err != nil {
		return result, err
	}
	if count >= 30 {
		return result, domain.Invalid("Максимум 30 подходов на упражнение")
	}
	result, err = readJSON[domain.Set](ctx, tx, `INSERT INTO workout_sets(id,session_exercise_id,set_number,weight_kg,reps)
 SELECT $1,se.id,COALESCE(last.set_number,0)+1,COALESCE(last.weight_kg,0),COALESCE(last.reps,se.target_reps_min)
 FROM workout_session_exercises se LEFT JOIN LATERAL(SELECT set_number,weight_kg,reps FROM workout_sets WHERE session_exercise_id=se.id ORDER BY set_number DESC LIMIT 1) last ON true WHERE se.id=$2 RETURNING to_jsonb(workout_sets)`, id, exerciseID)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
func (s *Store) DeleteSet(ctx context.Context, user, id string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer rollback(ctx, tx)
	_, err = lockSetParent(ctx, tx, user, id, false)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `DELETE FROM workout_sets WHERE id=$1`, id)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Store) History(ctx context.Context, user string, f repository.Filter) (domain.History, error) {
	return readJSON[domain.History](ctx, s.Pool, `WITH filtered AS (SELECT * FROM workout_sessions WHERE user_id=$1 AND finished_at IS NOT NULL AND ($2::timestamptz IS NULL OR started_at >= $2) AND ($3::timestamptz IS NULL OR started_at < $3)), page AS (
 SELECT s.id,s.name,s.started_at,s.finished_at,EXTRACT(EPOCH FROM(s.finished_at-s.started_at)) AS training_duration,1 AS training_count,s.estimated_calories,s.estimated_calories*.7 AS calories_low,s.estimated_calories*1.3 AS calories_high,
 (SELECT count(*) FROM workout_sets ws JOIN workout_session_exercises se ON se.id=ws.session_exercise_id WHERE se.session_id=s.id AND ws.completed) AS set_count,
 COALESCE((SELECT sum(ws.weight_kg*ws.reps) FROM workout_sets ws JOIN workout_session_exercises se ON se.id=ws.session_exercise_id WHERE se.session_id=s.id AND ws.completed),0) AS total_volume
 FROM filtered s ORDER BY s.started_at DESC LIMIT $4 OFFSET $5)
 SELECT jsonb_build_object('items',COALESCE((SELECT jsonb_agg(page ORDER BY started_at DESC) FROM page),'[]'),'total',(SELECT count(*) FROM filtered),'page',$6::int,'limit',$4::int)`, user, f.From, f.To, f.Limit, (f.Page-1)*f.Limit, f.Page)
}
func (s *Store) Previous(ctx context.Context, user, id string) (domain.Previous, error) {
	p, err := readJSON[domain.Previous](ctx, s.Pool, `SELECT jsonb_build_object('date',s.started_at,'sets',(SELECT jsonb_agg(ws ORDER BY ws.set_number) FROM workout_sets ws WHERE ws.session_exercise_id=se.id AND ws.completed)) FROM workout_sessions s JOIN workout_session_exercises se ON se.session_id=s.id WHERE s.user_id=$1 AND se.exercise_id=$2 AND s.finished_at IS NOT NULL AND EXISTS(SELECT 1 FROM workout_sets ws WHERE ws.session_exercise_id=se.id AND ws.completed) ORDER BY s.started_at DESC LIMIT 1`, user, id)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.Previous{Sets: []domain.Set{}}, nil
	}
	return p, err
}
func (s *Store) BodyWeights(ctx context.Context, user string) ([]domain.BodyWeight, error) {
	return readJSON[[]domain.BodyWeight](ctx, s.Pool, `SELECT COALESCE(jsonb_agg(w ORDER BY w.measured_at),'[]') FROM body_weight_entries w WHERE user_id=$1`, user)
}
func (s *Store) AddBodyWeight(ctx context.Context, user string, weight float64, at time.Time) (domain.BodyWeight, error) {
	var result domain.BodyWeight
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer rollback(ctx, tx)
	var locked string
	err = tx.QueryRow(ctx, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, user).Scan(&locked)
	if err != nil {
		return result, dbError(err)
	}
	result, err = readJSON[domain.BodyWeight](ctx, tx, `INSERT INTO body_weight_entries(user_id,weight_kg,measured_at) VALUES($1,$2,$3) RETURNING to_jsonb(body_weight_entries)`, user, weight, at)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `UPDATE users SET weight_kg=(SELECT weight_kg FROM body_weight_entries WHERE user_id=$1 ORDER BY measured_at DESC LIMIT 1) WHERE id=$1`, user)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}
func (s *Store) Profile(ctx context.Context, user string) (domain.Profile, error) {
	return readJSON[domain.Profile](ctx, s.Pool, `SELECT to_jsonb(u) FROM users u WHERE id=$1`, user)
}
