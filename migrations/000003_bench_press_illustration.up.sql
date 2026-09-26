UPDATE exercise_media AS media
SET url = '/illustrations/anatomy/barbell-bench-press-v1.webp'
FROM exercises AS exercise
WHERE media.exercise_id = exercise.id
  AND exercise.slug = 'barbell-bench-press'
  AND media.type = 'image'
  AND media.position = 0
  AND media.url = '/illustrations/push.svg';
