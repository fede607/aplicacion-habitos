/**
 * Esquemas de validación compartidos cliente/servidor. El servidor SIEMPRE
 * vuelve a validar (server actions) y la BD aplica constraints como última barrera.
 */
import { z } from "zod";
import { isIsoDate, isValidTimeZone } from "./dates";

const trimmed = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

export const isoDateSchema = z.string().refine(isIsoDate, "Fecha no válida");
export const uuidSchema = z.uuid("Identificador no válido");
export const timeZoneSchema = z.string().max(64).refine(isValidTimeZone, "Zona horaria no válida");
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "3-24 caracteres: letras minúsculas, números o _");

export const displayNameSchema = z.string().trim().min(1, "Escribe tu nombre").max(40, "Máximo 40 caracteres");

export const emailSchema = z.string().trim().toLowerCase().email("Email no válido").max(254);

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Incluye al menos una letra y un número");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  username: usernameSchema,
  timezone: timeZoneSchema.catch("Europe/Madrid"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Introduce tu contraseña").max(72),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, {
  message: "Las contraseñas no coinciden",
  path: ["confirm"],
});

export const habitStatusSchema = z.object({
  habitId: uuidSchema,
  date: isoDateSchema,
  status: z.enum(["done", "missed", "skipped"]).nullable(),
});

export const dailyEntrySchema = z.object({
  date: isoDateSchema,
  didToday: z.string().max(2000, "Máximo 2000 caracteres"),
  improveTomorrow: z.string().max(2000, "Máximo 2000 caracteres"),
  expectedUpdatedAt: z.string().max(64).nullable(),
});

export const WORKOUT_TYPES = ["gym", "boxing", "cardio", "mobility", "other"] as const;

const optionalScale = z.union([z.literal(""), z.coerce.number().int().min(1).max(10)]).transform((v) => (v === "" ? null : v));

export const workoutSchema = z.object({
  id: uuidSchema.optional(),
  date: isoDateSchema,
  type: z.enum(WORKOUT_TYPES, "Tipo no válido"),
  durationMin: z.coerce.number().int("Minutos enteros").min(1, "Mínimo 1 minuto").max(600, "Máximo 600 minutos"),
  intensity: optionalScale,
  feeling: optionalScale,
  exercises: trimmed(2000),
  notes: trimmed(2000),
  nextGoal: trimmed(500),
});

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
    description: trimmed(500),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    seedDefaults: z.boolean(),
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "La fecha de fin debe ser posterior",
    path: ["endDate"],
  });

export const groupSettingsSchema = z
  .object({
    groupId: uuidSchema,
    name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
    description: trimmed(500),
    rules: trimmed(2000),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    streakThreshold: z.coerce.number().int().min(1).max(100),
    comparisonEnabled: z.boolean(),
    maxMembers: z.coerce.number().int().min(2).max(1000),
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "La fecha de fin debe ser posterior",
    path: ["endDate"],
  });

export const HABIT_CATEGORIES = ["physical", "mental", "productivity", "health", "other"] as const;
export const HABIT_FREQUENCIES = ["daily", "weekdays", "weekly_target"] as const;
export const HABIT_WEIGHTS = [1, 1.5, 2] as const;

export const habitSchema = z
  .object({
    id: uuidSchema.optional(),
    groupId: uuidSchema,
    name: z.string().trim().min(1, "Escribe un nombre").max(60, "Máximo 60 caracteres"),
    description: trimmed(300),
    icon: z.string().regex(/^[a-z0-9-]{1,40}$/, "Icono no válido"),
    category: z.enum(HABIT_CATEGORIES),
    color: hexColorSchema,
    frequency: z.enum(HABIT_FREQUENCIES),
    weekdays: z.array(z.coerce.number().int().min(1).max(7)).max(7),
    weeklyTarget: z.coerce.number().int().min(1).max(7).nullable(),
    isOptional: z.boolean(),
    weight: z.coerce
      .number()
      .refine((v) => HABIT_WEIGHTS.includes(v as (typeof HABIT_WEIGHTS)[number]), "Peso no válido")
      .default(1),
    goal: trimmed(100),
    startsOn: isoDateSchema,
    /** Hábito personal (sólo tuyo) en vez de común del grupo. */
    personal: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "weekdays" && v.weekdays.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Elige al menos un día",
        path: ["weekdays"],
      });
    }
    if (v.frequency === "weekly_target" && !v.weeklyTarget) {
      ctx.addIssue({
        code: "custom",
        message: "Indica el objetivo semanal",
        path: ["weeklyTarget"],
      });
    }
  });

export const inviteCodeSchema = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{12}$/, "El código tiene 12 caracteres (letras y números)"));

export const createInvitationSchema = z.object({
  groupId: uuidSchema,
  expiresInHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 90)
    .nullable(),
  maxUses: z.coerce.number().int().min(1).max(1000).nullable(),
});

export const profileSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  avatarEmoji: z
    .string()
    .trim()
    .max(8)
    .transform((v) => (v === "" ? null : v)),
  avatarColor: hexColorSchema,
  timezone: timeZoneSchema,
});

export const preferencesSchema = z.object({
  shareHabits: z.boolean(),
  shareWorkouts: z.boolean(),
  showInComparison: z.boolean(),
  reminderEnabled: z.boolean(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida"),
});

/** Ruta interna segura para redirecciones post-login (evita open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/today"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.length > 200 || /[\r\n]/.test(next)) return fallback;
  return next;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// Perfil de entrenamiento (plan personalizado)
export const trainingProfileSchema = z
  .object({
    birthYear: z.coerce.number().int().min(1920).max(2020),
    sex: z.enum(["male", "female"]),
    heightCm: z.coerce.number().int().min(120, "Mínimo 120 cm").max(230, "Máximo 230 cm"),
    weightKg: z.coerce.number().min(30, "Mínimo 30 kg").max(250, "Máximo 250 kg"),
    goal: z.enum(["fat_loss", "recomp", "muscle", "strength", "endurance", "health"]),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    trainingType: z.enum(["gym", "home_dumbbells", "bodyweight", "running", "mixed"]),
    daysPerWeek: z.coerce.number().int().min(2).max(6),
    sessionMinutes: z.coerce
      .number()
      .int()
      .refine((v) => [30, 45, 60, 75, 90].includes(v), "Duración no válida"),
    limitations: z.array(z.enum(["knee", "lower_back", "shoulder", "wrist", "hip", "ankle"])).max(6),
    focus: z.enum(["balanced", "glutes_legs", "chest_arms", "back_posture", "shoulders", "core"]).default("balanced"),
    preferredDays: z.array(z.coerce.number().int().min(1).max(7)).max(7).default([]),
  })
  .refine((v) => v.preferredDays.length === 0 || new Set(v.preferredDays).size === v.daysPerWeek, {
    path: ["preferredDays"],
    message: "Elige tantos días como entrenos por semana (o ninguno).",
  });
