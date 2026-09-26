-- Replace only bundled placeholders; preserve custom media and the approved bench press.
UPDATE exercise_media AS media
SET url = '/illustrations/anatomy/' || exercise.slug || '-v1.webp'
FROM exercises AS exercise
WHERE media.exercise_id = exercise.id
  AND media.type = 'image'
  AND media.position = 0
  AND media.url IN ('/illustrations/push.svg', '/illustrations/pull.svg', '/illustrations/legs.svg')
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
