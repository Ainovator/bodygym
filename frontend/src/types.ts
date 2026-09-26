export interface Media {
  id: string
  type: 'image' | 'video'
  url: string
  position: number
}
export interface Exercise {
  id: string
  name: string
  slug: string
  description: string
  instructions: string[]
  common_mistakes: string[]
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string
  category: string
  calorie_class: string
  default_rest_seconds: number
  media: Media[]
}
export interface TemplateExercise {
  id?: string
  exercise_id: string
  position: number
  target_sets: number
  target_reps_min: number
  target_reps_max: number
  rest_seconds: number
  exercise: Exercise
}
export interface Template {
  id: string
  name: string
  description: string
  exercises: TemplateExercise[]
}
export interface WorkoutSet {
  id: string
  session_exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
  rir: number | null
  rpe: number | null
  completed: boolean
  started_at: string | null
  completed_at: string | null
  notes: string
}
export type SetPatch = Partial<
  Pick<WorkoutSet, 'weight_kg' | 'reps' | 'rir' | 'rpe' | 'completed' | 'notes' | 'started_at'>
>
export interface SessionExercise {
  id: string
  exercise_id: string
  position: number
  target_reps_min: number
  target_reps_max: number
  rest_seconds: number
  exercise: Exercise
  sets: WorkoutSet[]
}
export interface Summary {
  training_count: number
  training_duration: number
  set_count: number
  total_volume: number
  estimated_calories: number
  calories_low: number
  calories_high: number
}
export interface PersonalRecord {
  exercise_id: string
  exercise_name: string
  kind: string
  value: number
  previous: number
  weight_kg?: number
}
export interface Session {
  id: string
  template_id: string | null
  name: string
  started_at: string
  finished_at: string | null
  body_weight_kg: number
  estimated_calories: number
  notes: string
  personal_records: PersonalRecord[]
  exercises: SessionExercise[]
  summary: Summary
}
export interface HistoryItem extends Summary {
  id: string
  name: string
  started_at: string
  finished_at: string
}
export interface History {
  items: HistoryItem[]
  total: number
  page: number
  limit: number
}
export interface Period extends Summary {
  date: string
}
export interface Overview extends Summary {
  weeks: Period[]
  months: Period[]
}
export interface ExerciseStats {
  max_weight: number
  estimated_1rm: number
  best_reps_at_weight: { weight_kg: number; reps: number }[]
  series: { date: string; max_weight: number; volume: number; estimated_1rm: number }[]
  monthly_weight_change: number
  estimate_note: string
}
export interface Previous {
  date: string | null
  sets: WorkoutSet[]
}
export interface BodyWeight {
  id: string
  weight_kg: number
  measured_at: string
}
export interface Profile {
  id: string
  name: string
  weight_kg: number
}
