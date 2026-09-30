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
  note?: string;
};

const ALL: Level[] = ["beginner", "intermediate", "advanced"];
const MID_UP: Level[] = ["intermediate", "advanced"];
const ANY_EQ: Equipment[] = ["gym", "dumbbells", "bodyweight"];

/**
 * Biblioteca de ejercicios por patrón de movimiento, ordenada por preferencia.
 * La última variante de cada patrón sirve para cualquier material, nivel y
 * lesión: así siempre hay una opción segura.
 */
export const LIBRARY: Record<Pattern, Variant[]> = {
  squat: [
    { name: "Sentadilla trasera con barra", equipment: ["gym"], levels: MID_UP, avoid: ["knee", "lower_back"] },
    { name: "Sentadilla goblet", equipment: ["gym", "dumbbells"], levels: ALL, avoid: ["knee"] },
    { name: "Prensa de piernas (rango sin dolor)", equipment: ["gym"], levels: ALL, note: "Baja sólo hasta donde no notes molestia." },
    { name: "Sentadilla con pausa de 2 s", equipment: ["bodyweight"], levels: MID_UP, avoid: ["knee"] },
    { name: "Sentadilla a caja (a la altura de una silla)", equipment: ANY_EQ, levels: ALL, note: "Siéntate controlando y sube sin impulso." },
  ],
  hinge: [
    { name: "Peso muerto rumano con barra", equipment: ["gym"], levels: MID_UP, avoid: ["lower_back"] },
    { name: "Peso muerto rumano con mancuernas", equipment: ["gym", "dumbbells"], levels: ALL, avoid: ["lower_back"] },
    { name: "Hip thrust con barra", equipment: ["gym"], levels: ALL },
    { name: "Hip thrust a una pierna", equipment: ["bodyweight", "dumbbells"], levels: MID_UP },
    { name: "Puente de glúteo", equipment: ANY_EQ, levels: ALL, note: "Aprieta glúteo 1 s arriba." },
  ],
  hpush: [
    { name: "Press de banca con barra", equipment: ["gym"], levels: MID_UP, avoid: ["shoulder"] },
    { name: "Press de banca con mancuernas", equipment: ["gym"], levels: ALL, avoid: ["shoulder"] },
    { name: "Press de suelo con mancuernas", equipment: ["dumbbells"], levels: ALL },
    { name: "Flexiones", equipment: ["bodyweight"], levels: MID_UP, avoid: ["shoulder"] },
    { name: "Press en máquina con agarre neutro", equipment: ["gym"], levels: ALL },
    { name: "Flexiones inclinadas (manos en mesa, codos a 45º)", equipment: ANY_EQ, levels: ALL },
  ],
  vpush: [
    { name: "Press militar con mancuernas sentado", equipment: ["gym", "dumbbells"], levels: ALL, avoid: ["shoulder", "lower_back"] },
    { name: "Flexiones pica", equipment: ["bodyweight"], levels: MID_UP, avoid: ["shoulder"] },
    { name: "Press landmine a una mano", equipment: ["gym"], levels: ALL },
    { name: "Plancha con toques de hombro", equipment: ANY_EQ, levels: ALL, timed: true },
  ],
  hpull: [
    { name: "Remo con barra", equipment: ["gym"], levels: ["advanced"], avoid: ["lower_back"] },
    { name: "Remo en polea baja", equipment: ["gym"], levels: ALL },
    { name: "Remo con mancuerna a una mano (apoyado)", equipment: ["dumbbells"], levels: ALL },
    { name: "Remo invertido (barra baja o mesa firme)", equipment: ["bodyweight"], levels: ALL },
    { name: "Remo con toalla en la puerta", equipment: ANY_EQ, levels: ALL, note: "Cierra bien la puerta y tira del cuerpo hacia ella." },
  ],
  vpull: [
    { name: "Dominadas lastradas", equipment: ["gym"], levels: ["advanced"], avoid: ["shoulder"] },
    { name: "Dominadas", equipment: ["gym", "bodyweight"], levels: MID_UP, avoid: ["shoulder"], note: "Si no llegas al rango, usa goma elástica." },
    { name: "Jalón al pecho con agarre neutro", equipment: ["gym"], levels: ALL },
    { name: "Dominadas negativas (bajando en 4 s)", equipment: ["bodyweight"], levels: ["beginner"], avoid: ["shoulder"] },
    { name: "Pullover con mancuerna", equipment: ["dumbbells"], levels: ALL, avoid: ["shoulder"] },
    { name: "Remo con mancuerna a una mano (apoyado)", equipment: ["dumbbells"], levels: ALL },
    { name: "Remo con toalla en la puerta", equipment: ANY_EQ, levels: ALL },
  ],
  lunge: [
    { name: "Sentadilla búlgara", equipment: ANY_EQ, levels: MID_UP, avoid: ["knee"] },
    { name: "Zancadas hacia atrás", equipment: ANY_EQ, levels: ALL, avoid: ["knee"] },
    { name: "Step-up a un escalón bajo", equipment: ANY_EQ, levels: ALL, note: "Escalón a la altura de media espinilla." },
  ],
  core: [
    { name: "Rueda abdominal", equipment: ["gym"], levels: ["advanced"], avoid: ["lower_back"] },
    { name: "Pallof press en polea", equipment: ["gym"], levels: ALL },
    { name: "Plancha frontal", equipment: ANY_EQ, levels: ALL, timed: true, avoid: ["shoulder"] },
    { name: "Dead bug", equipment: ANY_EQ, levels: ALL, note: "Zona lumbar pegada al suelo todo el tiempo." },
  ],
  calves: [{ name: "Elevación de talones", equipment: ANY_EQ, levels: ALL }],
  biceps: [
    { name: "Curl de bíceps con mancuernas", equipment: ["gym", "dumbbells"], levels: ALL },
    { name: "Curl con toalla (isométrico)", equipment: ANY_EQ, levels: ALL, timed: true },
  ],
  triceps: [
    { name: "Extensión de tríceps en polea", equipment: ["gym"], levels: ALL },
    { name: "Fondos en banco", equipment: ["bodyweight", "dumbbells"], levels: MID_UP, avoid: ["shoulder"] },
    { name: "Extensión de tríceps con mancuerna", equipment: ["dumbbells"], levels: ALL },
    { name: "Flexiones diamante inclinadas", equipment: ANY_EQ, levels: ALL },
  ],
  lateral: [
    { name: "Elevaciones laterales", equipment: ["gym", "dumbbells"], levels: ALL },
    { name: "Plancha lateral", equipment: ANY_EQ, levels: ALL, timed: true },
  ],
};

export type ChosenExercise = { pattern: Pattern; name: string; timed: boolean; note?: string };

/** Primera variante compatible con el material, el nivel y las lesiones. */
export function pickExercise(pattern: Pattern, equipment: Equipment, level: Level, limitations: readonly Limitation[]): ChosenExercise {
  const options = LIBRARY[pattern];
  const ok = options.find(
    (v) => v.equipment.includes(equipment) && v.levels.includes(level) && !(v.avoid ?? []).some((a) => limitations.includes(a)),
  );
  const chosen = ok ?? options[options.length - 1];
  return { pattern, name: chosen.name, timed: chosen.timed === true, note: chosen.note };
}

/** Para los tests: ¿esta variante está desaconsejada con alguna de estas lesiones? */
export function isContraindicated(name: string, limitations: readonly Limitation[]): boolean {
  return Object.values(LIBRARY).some((vs) => vs.some((v) => v.name === name && (v.avoid ?? []).some((a) => limitations.includes(a))));
}
