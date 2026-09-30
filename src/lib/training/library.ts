import type { Level, Limitation } from "./types";

/** Material disponible según el tipo de entrenamiento. */
export type Equipment = "gym" | "dumbbells" | "bodyweight";

export type Pattern =
  | "squat"
  | "hinge"
  | "hpush"
  | "vpush"
  | "hpull"
  | "vpull"
  | "lunge"
  | "core"
  | "calves"
  | "biceps"
  | "triceps"
  | "lateral";

type Variant = {
  name: string;
  equipment: Equipment[];
  levels: Level[];
  /** Lesiones/molestias con las que NO se recomienda. */
  avoid?: Limitation[];
  /** Se mide en segundos (planchas…) en vez de repeticiones. */
  timed?: boolean;
  /** Músculos, si difieren de los del patrón. */
  muscles?: string;
  /** Clave de técnica en una frase. */
  cue?: string;
  note?: string;
};

const ALL: Level[] = ["beginner", "intermediate", "advanced"];
const MID_UP: Level[] = ["intermediate", "advanced"];
const ANY_EQ: Equipment[] = ["gym", "dumbbells", "bodyweight"];

export const PATTERN_MUSCLES: Record<Pattern, string> = {
  squat: "cuádriceps y glúteo",
  hinge: "glúteo e isquiotibiales",
  hpush: "pecho, hombro anterior y tríceps",
  vpush: "hombros y tríceps",
  hpull: "espalda media y bíceps",
  vpull: "dorsales y bíceps",
  lunge: "glúteo y cuádriceps (una pierna)",
  core: "abdomen y zona media",
  calves: "gemelos y sóleo",
  biceps: "bíceps",
  triceps: "tríceps",
  lateral: "deltoides lateral",
};

/**
 * Biblioteca de ejercicios por patrón de movimiento, ordenada por preferencia.
 * La última variante de cada patrón sirve para cualquier material, nivel y
 * lesión: así siempre hay una opción segura.
 */
export const LIBRARY: Record<Pattern, Variant[]> = {
  squat: [
    {
      name: "Sentadilla trasera con barra",
      equipment: ["gym"],
      levels: MID_UP,
      avoid: ["knee", "lower_back", "hip"],
      cue: "Pecho alto, rodillas en la línea de los pies y baja hasta donde mantengas la espalda neutra.",
    },
    {
      name: "Sentadilla goblet",
      equipment: ["gym", "dumbbells"],
      levels: ALL,
      avoid: ["knee"],
      cue: "Mancuerna pegada al pecho, codos entre las rodillas al bajar.",
    },
    {
      name: "Prensa de piernas (rango sin dolor)",
      equipment: ["gym"],
      levels: ALL,
      cue: "Lumbar pegada al respaldo; no bloquees las rodillas arriba.",
      note: "Baja sólo hasta donde no notes molestia.",
    },
    {
      name: "Sentadilla con pausa de 2 s",
      equipment: ["bodyweight"],
      levels: MID_UP,
      avoid: ["knee", "hip"],
      cue: "Pausa real abajo sin rebotar, sube explosivo.",
    },
    {
      name: "Sentadilla a caja (a la altura de una silla)",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Siéntate controlando 3 s y sube sin impulso.",
      note: "Sube la caja si notas molestia.",
    },
  ],
  hinge: [
    {
      name: "Peso muerto rumano con barra",
      equipment: ["gym"],
      levels: MID_UP,
      avoid: ["lower_back"],
      cue: "Cadera atrás como cerrando una puerta con el culo, barra rozando las piernas.",
    },
    {
      name: "Peso muerto rumano con mancuernas",
      equipment: ["gym", "dumbbells"],
      levels: ALL,
      avoid: ["lower_back"],
      cue: "Rodillas algo flexionadas y espalda neutra; baja hasta notar estiramiento en isquios.",
    },
    {
      name: "Hip thrust con barra",
      equipment: ["gym"],
      levels: ALL,
      cue: "Barbilla al pecho y costillas abajo; empuja con los talones y aprieta 1 s.",
    },
    {
      name: "Hip thrust a una pierna",
      equipment: ["bodyweight", "dumbbells"],
      levels: MID_UP,
      avoid: ["hip"],
      cue: "Pelvis nivelada, sin girar la cadera.",
    },
    {
      name: "Puente de glúteo",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Aprieta glúteo 1 s arriba sin arquear la lumbar.",
    },
  ],
  hpush: [
    {
      name: "Press de banca con barra",
      equipment: ["gym"],
      levels: MID_UP,
      avoid: ["shoulder", "wrist"],
      cue: "Escápulas juntas y abajo, barra a la altura del esternón, codos a 45º.",
    },
    {
      name: "Press de banca con mancuernas",
      equipment: ["gym"],
      levels: ALL,
      avoid: ["shoulder"],
      cue: "Baja controlando hasta la línea del pecho, codos a 45º.",
    },
    {
      name: "Press de suelo con mancuernas",
      equipment: ["dumbbells"],
      levels: ALL,
      cue: "Agarre neutro; toca el suelo con los codos y sube sin rebote.",
    },
    {
      name: "Flexiones",
      equipment: ["bodyweight"],
      levels: MID_UP,
      avoid: ["shoulder", "wrist"],
      cue: "Cuerpo en bloque de cabeza a talones, pecho casi al suelo.",
    },
    {
      name: "Press en máquina con agarre neutro",
      equipment: ["gym"],
      levels: ALL,
      cue: "Espalda pegada al respaldo, empuja sin despegar los hombros.",
    },
    {
      name: "Flexiones inclinadas (manos en mesa, codos a 45º)",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Cuanto más alta la superficie, más fácil.",
      note: "Si te molesta la muñeca, apóyate sobre los puños.",
    },
  ],
  vpush: [
    {
      name: "Press militar con mancuernas sentado",
      equipment: ["gym", "dumbbells"],
      levels: ALL,
      avoid: ["shoulder", "lower_back"],
      cue: "Abdomen firme, sube las mancuernas ligeramente hacia delante.",
    },
    {
      name: "Flexiones pica",
      equipment: ["bodyweight"],
      levels: MID_UP,
      avoid: ["shoulder", "wrist"],
      cue: "Cadera alta, la cabeza baja entre las manos.",
    },
    {
      name: "Press landmine a una mano",
      equipment: ["gym"],
      levels: ALL,
      cue: "Empuja en diagonal, el ángulo es amable con el hombro.",
    },
    {
      name: "Plancha con toques de hombro",
      equipment: ANY_EQ,
      levels: ALL,
      timed: true,
      avoid: ["wrist"],
      muscles: "hombros y abdomen",
      cue: "Pies separados y cadera quieta al tocar.",
    },
    {
      name: "Elevaciones en Y tumbado boca abajo",
      equipment: ANY_EQ,
      levels: ALL,
      muscles: "hombros y trapecio inferior",
      cue: "Pulgares hacia arriba, sube los brazos en Y sin encoger los hombros.",
    },
  ],
  hpull: [
    {
      name: "Remo con barra",
      equipment: ["gym"],
      levels: ["advanced"],
      avoid: ["lower_back"],
      cue: "Torso a 45º fijo, tira hacia el ombligo.",
    },
    {
      name: "Remo en polea baja",
      equipment: ["gym"],
      levels: ALL,
      cue: "Pecho alto, junta escápulas antes de doblar los codos.",
    },
    {
      name: "Remo con mancuerna a una mano (apoyado)",
      equipment: ["dumbbells", "gym"],
      levels: ALL,
      cue: "Tira del codo hacia la cadera, no hacia arriba.",
    },
    {
      name: "Remo invertido (barra baja o mesa firme)",
      equipment: ["bodyweight"],
      levels: ALL,
      cue: "Cuerpo recto, pecho a la barra.",
    },
    {
      name: "Remo con toalla en la puerta",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Pies cerca de la puerta = más difícil.",
      note: "Cierra bien la puerta y tira del cuerpo hacia ella.",
    },
  ],
  vpull: [
    {
      name: "Dominadas lastradas",
      equipment: ["gym"],
      levels: ["advanced"],
      avoid: ["shoulder"],
      cue: "Recorrido completo, sin balanceo.",
    },
    {
      name: "Dominadas",
      equipment: ["gym", "bodyweight"],
      levels: MID_UP,
      avoid: ["shoulder"],
      cue: "Empieza bajando los hombros y lleva el pecho a la barra.",
      note: "Si no llegas al rango, usa goma elástica.",
    },
    {
      name: "Jalón al pecho con agarre neutro",
      equipment: ["gym"],
      levels: ALL,
      cue: "Lleva la barra a la clavícula con el pecho alto.",
    },
    {
      name: "Dominadas negativas (bajando en 4 s)",
      equipment: ["bodyweight"],
      levels: ["beginner"],
      avoid: ["shoulder"],
      cue: "Sube con un salto y baja lo más lento posible.",
    },
    {
      name: "Pullover con mancuerna",
      equipment: ["dumbbells"],
      levels: ALL,
      avoid: ["shoulder"],
      cue: "Codos algo flexionados, baja hasta notar estiramiento en dorsales.",
    },
    {
      name: "Remo con mancuerna a una mano (apoyado)",
      equipment: ["dumbbells"],
      levels: ALL,
      muscles: "dorsales y espalda media",
      cue: "Tira del codo hacia la cadera.",
    },
    {
      name: "Remo con toalla en la puerta",
      equipment: ANY_EQ,
      levels: ALL,
      muscles: "dorsales y espalda media",
      cue: "Codos pegados al cuerpo.",
    },
  ],
  lunge: [
    {
      name: "Sentadilla búlgara",
      equipment: ANY_EQ,
      levels: MID_UP,
      avoid: ["knee", "hip", "ankle"],
      cue: "Pie trasero en un banco, el peso en la pierna de delante.",
    },
    {
      name: "Zancadas hacia atrás",
      equipment: ANY_EQ,
      levels: ALL,
      avoid: ["knee", "hip", "ankle"],
      cue: "Paso largo atrás, rodilla trasera casi al suelo.",
    },
    {
      name: "Step-up a un escalón bajo",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Sube empujando con la pierna de arriba, no con la de abajo.",
      note: "Escalón a la altura de media espinilla.",
    },
  ],
  core: [
    {
      name: "Rueda abdominal",
      equipment: ["gym"],
      levels: ["advanced"],
      avoid: ["lower_back", "shoulder"],
      cue: "Costillas abajo, no dejes que la lumbar se hunda.",
    },
    {
      name: "Pallof press en polea",
      equipment: ["gym"],
      levels: ALL,
      cue: "Resiste el giro: el tronco no se mueve.",
    },
    {
      name: "Plancha frontal",
      equipment: ANY_EQ,
      levels: ALL,
      timed: true,
      avoid: ["shoulder"],
      cue: "Sobre antebrazos, aprieta glúteo y abdomen.",
    },
    {
      name: "Dead bug",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Zona lumbar pegada al suelo todo el tiempo; exhala al estirar.",
    },
  ],
  calves: [
    {
      name: "Elevación de talones de pie",
      equipment: ANY_EQ,
      levels: ALL,
      avoid: ["ankle"],
      cue: "Pausa 1 s arriba y baja lento hasta estirar.",
    },
    {
      name: "Elevación de talones sentado (rango cómodo)",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Peso sobre las rodillas, sube y baja lento.",
    },
  ],
  biceps: [
    {
      name: "Curl de bíceps con mancuernas",
      equipment: ["gym", "dumbbells"],
      levels: ALL,
      avoid: ["wrist"],
      cue: "Codos pegados, sin balancear el cuerpo.",
    },
    {
      name: "Curl martillo",
      equipment: ["gym", "dumbbells"],
      levels: ALL,
      muscles: "bíceps y antebrazo",
      cue: "Agarre neutro, más amable con la muñeca.",
    },
    {
      name: "Curl con toalla (isométrico)",
      equipment: ANY_EQ,
      levels: ALL,
      timed: true,
      cue: "Pisa la toalla y tira fuerte con los codos a 90º.",
    },
  ],
  triceps: [
    {
      name: "Extensión de tríceps en polea",
      equipment: ["gym"],
      levels: ALL,
      cue: "Codos fijos a los lados, estira del todo abajo.",
    },
    {
      name: "Fondos en banco",
      equipment: ["bodyweight", "dumbbells"],
      levels: MID_UP,
      avoid: ["shoulder", "wrist"],
      cue: "Baja sólo hasta 90º de codo.",
    },
    {
      name: "Extensión de tríceps con mancuerna",
      equipment: ["dumbbells"],
      levels: ALL,
      avoid: ["shoulder"],
      cue: "Codos apuntando al techo.",
    },
    {
      name: "Flexiones diamante inclinadas",
      equipment: ANY_EQ,
      levels: ALL,
      cue: "Manos juntas sobre una mesa, codos pegados.",
      note: "Si te molesta la muñeca, hazlas sobre los puños.",
    },
  ],
  lateral: [
    {
      name: "Elevaciones laterales",
      equipment: ["gym", "dumbbells"],
      levels: ALL,
      cue: "Sube hasta la altura del hombro, codos ligeramente flexionados.",
    },
    {
      name: "Plancha lateral",
      equipment: ANY_EQ,
      levels: ALL,
      timed: true,
      muscles: "oblicuos y hombro",
      cue: "Cuerpo recto, cadera alta.",
    },
  ],
};

export type ChosenExercise = {
  pattern: Pattern;
  name: string;
  timed: boolean;
  muscles: string;
  cue?: string;
  note?: string;
  alternatives: string[];
};

const LEVEL_RANK: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const fits = (
  v: Variant,
  equipment: Equipment,
  level: Level,
  limitations: readonly Limitation[],
) =>
  v.equipment.includes(equipment) &&
  v.levels.includes(level) &&
  !(v.avoid ?? []).some((a) => limitations.includes(a));

/** Primera variante compatible con el material, el nivel y las lesiones (+ hasta 2 alternativas). */
export function pickExercise(
  pattern: Pattern,
  equipment: Equipment,
  level: Level,
  limitations: readonly Limitation[],
): ChosenExercise {
  const options = LIBRARY[pattern];
  const compatible = options.filter((v) =>
    fits(v, equipment, level, limitations),
  );
  const chosen = compatible[0] ?? options[options.length - 1];
  // Alternativas: mismo material y lesiones; el nivel puede ser inferior (siempre es seguro bajar).
  const alternatives = options
    .filter(
      (v) =>
        v.name !== chosen.name &&
        v.equipment.includes(equipment) &&
        !(v.avoid ?? []).some((a) => limitations.includes(a)),
    )
    .filter((v) => v.levels.some((l) => LEVEL_RANK[l] <= LEVEL_RANK[level]))
    .slice(0, 2)
    .map((v) => v.name);
  return {
    pattern,
    name: chosen.name,
    timed: chosen.timed === true,
    muscles: chosen.muscles ?? PATTERN_MUSCLES[pattern],
    cue: chosen.cue,
    note: chosen.note,
    alternatives,
  };
}

/** Para los tests: ¿esta variante está desaconsejada con alguna de estas lesiones? */
export function isContraindicated(
  name: string,
  limitations: readonly Limitation[],
): boolean {
  return Object.values(LIBRARY).some((vs) =>
    vs.some(
      (v) =>
        v.name === name && (v.avoid ?? []).some((a) => limitations.includes(a)),
    ),
  );
}
