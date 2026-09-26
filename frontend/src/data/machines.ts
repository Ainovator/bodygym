export interface Machine {
  id: string
  name: string
  brand: string
  model: string
  groups: string[]
  muscles: string[]
  description: string
  recognition: string
  exerciseSlugs: string[]
  image: string
  sourceUrl: string
}

export const machines: Machine[] = [
  {
    "id": "hammer-strength-select-lat-pulldown",
    "name": "Верхний блок",
    "brand": "Hammer Strength",
    "model": "Select Lat Pulldown",
    "groups": [
      "Спина"
    ],
    "muscles": [
      "Широчайшие",
      "Бицепс"
    ],
    "description": "Вертикальная тяга сидя с грузовым стеком и широкой рукоятью.",
    "recognition": "Узнаётся по верхнему блоку, длинному грифу и валикам для фиксации бёдер.",
    "exerciseSlugs": [
      "lat-pulldown"
    ],
    "image": "/equipment/hammer-strength-select-lat-pulldown-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/hammer-strength-select-lat-pulldown"
  },
  {
    "id": "insignia-series-row",
    "name": "Горизонтальная тяга",
    "brand": "Life Fitness",
    "model": "Insignia Series Row",
    "groups": [
      "Спина"
    ],
    "muscles": [
      "Широчайшие",
      "Ромбовидные"
    ],
    "description": "Рычажная тяга сидя с опорой грудью и независимым движением рукоятей.",
    "recognition": "Перед сиденьем находится грудная опора; рукояти расположены по обе стороны от неё.",
    "exerciseSlugs": [],
    "image": "/equipment/insignia-series-row-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-row"
  },
  {
    "id": "insignia-series-pectoral-fly-rear-deltoid",
    "name": "Бабочка / задняя дельта",
    "brand": "Life Fitness",
    "model": "Insignia Series Pectoral Fly/Rear Deltoid",
    "groups": [
      "Грудь",
      "Плечи"
    ],
    "muscles": [
      "Грудные мышцы",
      "Задняя дельта"
    ],
    "description": "Два движения в одном тренажёре: сведение рук перед собой и обратное разведение.",
    "recognition": "Высокая вертикальная опора и два длинных поворотных рычага на уровне плеч.",
    "exerciseSlugs": [
      "reverse-pec-deck"
    ],
    "image": "/equipment/insignia-series-pectoral-fly-rear-deltoid-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-pectoral-fly-rear-deltoid"
  },
  {
    "id": "insignia-series-leg-press",
    "name": "Жим ногами",
    "brand": "Life Fitness",
    "model": "Insignia Series Arc Leg Press",
    "groups": [
      "Ноги"
    ],
    "muscles": [
      "Квадрицепс",
      "Ягодичные"
    ],
    "description": "Грузоблочный жим ногами с движением по дуге. Модель Arc отличается от наклонных саней.",
    "recognition": "Большая платформа для стоп напротив сиденья и регулируемая опора спины.",
    "exerciseSlugs": [
      "leg-press"
    ],
    "image": "/equipment/insignia-series-leg-press-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-leg-press"
  },
  {
    "id": "insignia-series-leg-extension",
    "name": "Разгибание ног",
    "brand": "Life Fitness",
    "model": "Insignia Series Leg Extension",
    "groups": [
      "Ноги"
    ],
    "muscles": [
      "Квадрицепс"
    ],
    "description": "Тренажёр для разгибания коленей сидя с валиком перед голенями.",
    "recognition": "Сиденье со спинкой, боковые рукояти и низкий валик на подвижном рычаге.",
    "exerciseSlugs": [
      "leg-extension"
    ],
    "image": "/equipment/insignia-series-leg-extension-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-leg-extension"
  },
  {
    "id": "insignia-series-leg-curl",
    "name": "Сгибание ног лёжа",
    "brand": "Life Fitness",
    "model": "Insignia Series Leg Curl",
    "groups": [
      "Ноги"
    ],
    "muscles": [
      "Задняя поверхность бедра"
    ],
    "description": "Сгибание коленей лёжа на животе с сопротивлением грузового стека.",
    "recognition": "Длинная наклонная подушка для корпуса и валик у ножного конца скамьи.",
    "exerciseSlugs": [
      "leg-curl"
    ],
    "image": "/equipment/insignia-series-leg-curl-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-leg-curl"
  },
  {
    "id": "insignia-series-shoulder-press",
    "name": "Жим от плеч",
    "brand": "Life Fitness",
    "model": "Insignia Series Shoulder Press",
    "groups": [
      "Плечи"
    ],
    "muscles": [
      "Дельтовидные",
      "Трицепс"
    ],
    "description": "Вертикальный жим сидя с опорой спины и рычажными рукоятями.",
    "recognition": "Вертикальная спинка и рукояти над сиденьем, направленные вверх.",
    "exerciseSlugs": [],
    "image": "/equipment/insignia-series-shoulder-press-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-shoulder-press"
  },
  {
    "id": "insignia-series-chest-press",
    "name": "Жим от груди",
    "brand": "Life Fitness",
    "model": "Insignia Series Chest Press",
    "groups": [
      "Грудь"
    ],
    "muscles": [
      "Грудные мышцы",
      "Трицепс"
    ],
    "description": "Жим сидя с независимыми рычагами, которые сходятся перед корпусом.",
    "recognition": "Сиденье со спинкой и две рукояти перед грудью; движение направлено вперёд.",
    "exerciseSlugs": [],
    "image": "/equipment/insignia-series-chest-press-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-chest-press"
  },
  {
    "id": "insignia-series-assist-dip-chin",
    "name": "Гравитрон",
    "brand": "Life Fitness",
    "model": "Insignia Series Assist Dip Chin",
    "groups": [
      "Спина",
      "Грудь",
      "Руки"
    ],
    "muscles": [
      "Широчайшие",
      "Грудные мышцы",
      "Трицепс"
    ],
    "description": "Подтягивания и отжимания на брусьях с противовесом, который помогает движению.",
    "recognition": "Высокая рама с перекладиной, брусьями и подвижной опорой для коленей.",
    "exerciseSlugs": [],
    "image": "/equipment/insignia-series-assist-dip-chin-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/insignia-series-assist-dip-chin"
  },
  {
    "id": "life-fitness-adjustable-cable-crossover",
    "name": "Кроссовер",
    "brand": "Life Fitness",
    "model": "Adjustable Cable Crossover",
    "groups": [
      "Грудь",
      "Руки",
      "Корпус"
    ],
    "muscles": [
      "Грудные мышцы",
      "Трицепс",
      "Пресс"
    ],
    "description": "Две регулируемые блочные стойки для упражнений с тросовым сопротивлением.",
    "recognition": "Два грузовых стека соединены верхней перекладиной; высота каждого блока регулируется.",
    "exerciseSlugs": [
      "cable-fly",
      "triceps-pushdown",
      "overhead-triceps-extension",
      "cable-crunch"
    ],
    "image": "/equipment/life-fitness-adjustable-cable-crossover-v1.webp",
    "sourceUrl": "https://shop.lifefitness.com/products/life-fitness-adjustable-cable-crossover"
  }
]
