UPDATE exercise_media AS media
SET url = '/illustrations/' || CASE
  WHEN exercise.category IN ('грудь', 'трицепс') THEN 'push'
  WHEN exercise.category IN ('спина', 'бицепс', 'плечи') THEN 'pull'
  ELSE 'legs'
END || '.svg'
FROM exercises AS exercise
WHERE media.exercise_id = exercise.id
  AND media.type = 'image'
  AND media.position = 0
  AND media.url = '/illustrations/anatomy/' || exercise.slug || '-v1.webp'
  AND exercise.slug IN (
    'incline-dumbbell-press',
    'cable-fly',
    'lat-pulldown',
    'chest-supported-row',
    'seated-cable-row',
    'seated-dumbbell-press',
    'lateral-raise',
    'reverse-pec-deck',
    'dumbbell-curl',
    'hammer-curl',
    'triceps-pushdown',
    'overhead-triceps-extension',
    'leg-press',
    'leg-extension',
    'goblet-squat',
    'leg-curl',
    'romanian-deadlift',
    'hip-thrust',
    'step-up',
    'standing-calf-raise',
    'seated-calf-raise',
    'cable-crunch',
    'reverse-crunch'
  );
