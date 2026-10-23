import type { Goal, Nutrition, TrainingProfile } from "./types";

export type MealIdea = { name: string; idea: string };

/** Recomendaciones de alimentación según objetivo, edad y tipo de entreno (orientativas, no médicas). */
export type DietGuide = {
  /** Proteína por comida (g) para repartirla en 4 tomas. */
  proteinPerMeal: number;
  meals: MealIdea[];
  eatMore: string[];
  limit: string[];
  dont: string[];
  training: string[];
  disclaimer: string;
};

const MEALS: Record<"cut" | "keep" | "gain", MealIdea[]> = {
  cut: [
    { name: "Desayuno", idea: "Tortilla de 2 huevos + claras, pan integral y una pieza de fruta." },
    { name: "Comida", idea: "Medio plato de verdura, pollo o pescado a la plancha y un puñado de arroz o patata." },
    { name: "Merienda", idea: "Yogur natural o skyr con frutos rojos (o fruta + un puñado pequeño de frutos secos)." },
    { name: "Cena", idea: "Ensalada o verdura salteada con huevo, atún, tofu o pavo. Ligera y con proteína." },
  ],
  keep: [
    { name: "Desayuno", idea: "Avena con leche o yogur, fruta y un puñado de frutos secos." },
    { name: "Comida", idea: "Legumbres o arroz/pasta integral con carne magra o pescado y verdura." },
    { name: "Merienda", idea: "Bocadillo integral de pavo, atún o queso fresco + fruta." },
    { name: "Cena", idea: "Pescado o huevos con verdura y una ración de patata, pan o arroz." },
  ],
  gain: [
    { name: "Desayuno", idea: "Avena con leche, plátano, crema de cacahuete y 2-3 huevos." },
    { name: "Comida", idea: "Plato grande de arroz o pasta con pollo, ternera o salmón, verdura y aceite de oliva." },
    { name: "Merienda", idea: "Bocadillo integral con proteína + yogur + fruta (o batido de leche, plátano y avena)." },
    { name: "Cena", idea: "Proteína (pescado, carne, huevos o tofu) con patata o arroz, verdura y pan." },
  ],
};

export function dietGuide(p: TrainingProfile, goal: Goal, n: Nutrition): DietGuide {
  const minor = p.age < 18;
  const mode = minor ? "keep" : goal === "fat_loss" || goal === "recomp" ? "cut" : goal === "muscle" ? "gain" : "keep";
  const endurance = p.trainingType === "running" || goal === "endurance";

  const eatMore = [
    "Proteína en cada comida: huevos, pollo, pavo, pescado, legumbres, tofu, yogur o queso fresco.",
    "Verdura y fruta todos los días (al menos 5 raciones entre las dos).",
    "Hidratos de calidad: avena, arroz, patata, pan integral, pasta y legumbres.",
    "Grasas buenas en poca cantidad: aceite de oliva, aguacate, frutos secos y pescado azul.",
    `Agua: unos ${n.waterL} L al día, y más los días de entreno o de calor.`,
  ];
  if (endurance) eatMore.push("Como corres o haces cardio, no te quites los hidratos: son tu gasolina.");

  const limit = [
    "Bollería, galletas, dulces y comida ultraprocesada: como algo ocasional, no a diario.",
    "Refrescos y zumos con azúcar: mejor agua, agua con gas o infusiones.",
    "Fritos, comida rápida y salsas: guárdalos para algún día especial.",
  ];
  if (mode === "cut") limit.push("Picoteo entre horas y \"calorías líquidas\" (cafés con azúcar, batidos dulces): suman mucho sin llenar.");
  if (!minor) limit.push("Alcohol: frena la recuperación y el progreso. Cuanto menos, mejor.");

  const dont = [
    "No te saltes comidas para \"compensar\": acabas comiendo más después.",
    "No hagas dietas milagro, detox ni ayunos extremos.",
    "No entrenes en ayunas largas si te mareas o te cuesta rendir.",
    "No te obsesiones con la báscula: mira cómo te sientes, cómo rindes y cómo te queda la ropa.",
  ];
  if (minor) {
    dont.push("No hagas dietas de déficit ni cuentes calorías al detalle: estás creciendo y necesitas energía.");
    dont.push("No tomes suplementos (quemadores, proteína en polvo, creatina…) sin hablarlo antes con tu médico o tus padres.");
    dont.push("Nada de bebidas energéticas: llevan mucha cafeína y azúcar.");
  } else if (mode === "cut") {
    dont.push(`No bajes de unas ${n.targetKcal} kcal al día: perderías músculo y energía.`);
  } else if (mode === "gain") {
    dont.push("No uses el volumen como excusa para comer \"de todo\": gana peso despacio y con comida de calidad.");
  }

  const training = [
    "Antes de entrenar (1-2 h): algo con hidratos y un poco de proteína, por ejemplo tostada con pavo o yogur con fruta.",
    "Después de entrenar: una comida con proteína e hidratos en las 2 horas siguientes.",
    "Bebe agua durante el entreno, sobre todo si sudas mucho.",
    "Duerme 7-9 horas: el descanso cuenta tanto como la comida.",
  ];
  if (endurance) training.push("En carreras de más de 60-75 minutos lleva agua y algo de hidrato (plátano, dátiles o una bebida isotónica).");

  return {
    proteinPerMeal: Math.round(n.proteinG / 4),
    meals: MEALS[mode],
    eatMore,
    limit,
    dont,
    training,
    disclaimer:
      "Son recomendaciones generales, no un plan médico. Si tienes alergias, alguna enfermedad, estás embarazada o tienes una relación difícil con la comida, habla con tu médico o un dietista-nutricionista.",
  };
}
