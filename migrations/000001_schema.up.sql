CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    weight_kg numeric(5,2) NOT NULL DEFAULT 80 CHECK (weight_kg BETWEEN 20 AND 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL,
    instructions jsonb NOT NULL DEFAULT '[]', common_mistakes jsonb NOT NULL DEFAULT '[]',
    primary_muscles jsonb NOT NULL DEFAULT '[]', secondary_muscles jsonb NOT NULL DEFAULT '[]',
    equipment text NOT NULL, category text NOT NULL,
    calorie_class text NOT NULL CHECK (calorie_class IN ('isolation','machine_compound','compound','high_intensity')),
    default_rest_seconds int NOT NULL CHECK (default_rest_seconds BETWEEN 0 AND 900),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercises_category_idx ON exercises(category);
CREATE TABLE exercise_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('image','video')), url text NOT NULL, position int NOT NULL DEFAULT 0,
    UNIQUE(exercise_id,position)
);
CREATE TABLE workout_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120), description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_templates_user_idx ON workout_templates(user_id);
CREATE TABLE workout_template_exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id uuid NOT NULL REFERENCES exercises(id), position int NOT NULL CHECK (position >= 0),
    target_sets int NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
    target_reps_min int NOT NULL CHECK (target_reps_min BETWEEN 1 AND 100),
    target_reps_max int NOT NULL CHECK (target_reps_max BETWEEN target_reps_min AND 100),
    rest_seconds int NOT NULL CHECK (rest_seconds BETWEEN 0 AND 900), UNIQUE(template_id,position)
);
CREATE INDEX workout_template_exercises_exercise_idx ON workout_template_exercises(exercise_id);
CREATE TABLE workout_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
    name text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
    body_weight_kg numeric(5,2) NOT NULL CHECK (body_weight_kg BETWEEN 20 AND 500),
    estimated_calories numeric(10,2) NOT NULL DEFAULT 0,
    personal_records jsonb NOT NULL DEFAULT '[]', notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(), CHECK(finished_at IS NULL OR finished_at >= started_at)
);
CREATE INDEX workout_sessions_user_started_idx ON workout_sessions(user_id, started_at DESC);
CREATE UNIQUE INDEX workout_sessions_one_active_idx ON workout_sessions(user_id) WHERE finished_at IS NULL;
CREATE TABLE workout_session_exercises (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id uuid NOT NULL REFERENCES exercises(id), position int NOT NULL,
    target_reps_min int NOT NULL, target_reps_max int NOT NULL, rest_seconds int NOT NULL,
    started_at timestamptz, finished_at timestamptz, UNIQUE(session_id,position)
);
CREATE INDEX workout_session_exercises_exercise_idx ON workout_session_exercises(exercise_id);
CREATE TABLE workout_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_exercise_id uuid NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
    set_number int NOT NULL CHECK (set_number > 0), weight_kg numeric(7,2) NOT NULL DEFAULT 0 CHECK (weight_kg BETWEEN 0 AND 1000),
    reps int NOT NULL DEFAULT 10 CHECK (reps BETWEEN 1 AND 100),
    rir numeric(3,1) CHECK (rir BETWEEN 0 AND 10), rpe numeric(3,1) CHECK (rpe BETWEEN 1 AND 10),
    completed boolean NOT NULL DEFAULT false, started_at timestamptz, completed_at timestamptz,
    notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(session_exercise_id,set_number), CHECK(completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX workout_sets_session_exercise_idx ON workout_sets(session_exercise_id);
CREATE TABLE body_weight_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg numeric(5,2) NOT NULL CHECK (weight_kg BETWEEN 20 AND 500), measured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX body_weight_entries_user_measured_idx ON body_weight_entries(user_id,measured_at DESC);
