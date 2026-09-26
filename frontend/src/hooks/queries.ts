import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { overlay } from '../lib/offline'
import type {
  Exercise,
  Template,
  Session,
  Previous,
  Profile,
  Overview,
  History,
  ExerciseStats,
  BodyWeight,
} from '../types'
export const useExercises = () =>
  useQuery({
    queryKey: ['exercises'],
    queryFn: () => api<Exercise[]>('/exercises'),
    staleTime: 3600_000,
    refetchOnMount: 'always',
  })
export const useTemplates = () =>
  useQuery({ queryKey: ['templates'], queryFn: () => api<Template[]>('/workout-templates') })
export const useActive = () =>
  useQuery({ queryKey: ['active'], queryFn: () => api<Session | null>('/workouts/active') })
export const useWorkout = (id: string) =>
  useQuery({
    queryKey: ['workout', id],
    queryFn: async () => overlay(await api<Session>(`/workouts/${id}`)),
    enabled: !!id,
  })
export const usePrevious = (id: string) =>
  useQuery({
    queryKey: ['previous', id],
    queryFn: () => api<Previous>(`/exercises/${id}/previous`),
  })
export const useProfile = () =>
  useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/me') })
export const useOverview = (filter = '') =>
  useQuery({
    queryKey: ['overview', filter],
    queryFn: () => api<Overview>(`/stats/overview?${filter}`),
  })
export const useHistory = (filter = '') =>
  useQuery({ queryKey: ['history', filter], queryFn: () => api<History>(`/history?${filter}`) })
export const useExerciseStats = (id: string) =>
  useQuery({
    queryKey: ['exercise-stats', id],
    queryFn: () => api<ExerciseStats>(`/stats/exercises/${id}`),
    enabled: !!id,
  })
export const useBodyWeights = () =>
  useQuery({ queryKey: ['body-weights'], queryFn: () => api<BodyWeight[]>('/stats/body-weight') })
