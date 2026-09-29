/**
 * Traducción de errores técnicos a mensajes comprensibles. Nunca se devuelve al
 * usuario el mensaje crudo de la BD; se registra en servidor sin datos sensibles.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: string };

type DbError = { code?: string; message?: string } | null | undefined;

const MESSAGES: Record<string, string> = {
  WA403: "No tienes permiso para hacer esto.",
  WA404: "No se ha encontrado lo que buscas.",
  WA409: "Esta acción no es posible en el estado actual.",
  WA422: "Los datos no son válidos.",
  WA429: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
  "23505": "Ya existe un registro con esos datos.",
  "23514": "Los datos no cumplen las reglas permitidas.",
  "42501": "No tienes permiso para hacer esto.",
  PGRST116: "No se ha encontrado lo que buscas.",
};

const SPECIFIC: [RegExp, string][] = [
  [/date not editable/, "Ese día ya no se puede editar (sólo los últimos 7 días)."],
  [/habit not available/, "Este hábito ya no está activo."],
  [/last admin/, "Eres el único admin: transfiere la administración antes."],
  [/cannot remove admin/, "No puedes expulsar a otro administrador."],
  [/too many habits/, "Has alcanzado el máximo de hábitos del grupo."],
  [/too many workouts/, "Demasiados entrenamientos registrados ese día."],
  [/invalid timezone/, "Zona horaria no válida."],
  [/pro required/, "Esta sala es Pro: hazte Pro para usar esta función."],
  [/already subscribed/, "Ya tiene una suscripción de PayPal activa."],
  [/not a member/, "Esa persona no es miembro de la sala."],
  [/duel exists/, "Ya tenéis un duelo esa semana."],
  [/habits not shared/, "Los dos tenéis que compartir vuestros hábitos con el grupo para batiros en duelo."],
  [/too many duels/, "Como máximo 3 retos por semana."],
  [/duel closed/, "Este duelo ya no admite cambios."],
  [/invalid week/, "Sólo puedes retar para esta semana o la próxima."],
  [/profiles_username_key|duplicate key.*username/, "Ese nombre de usuario ya está cogido."],
];

export const GENERIC_ERROR = "Ha ocurrido un error al guardar. Inténtalo de nuevo.";

export function dbErrorMessage(error: DbError, fallback = GENERIC_ERROR): string {
  if (!error) return fallback;
  const msg = error.message ?? "";
  for (const [re, text] of SPECIFIC) if (re.test(msg)) return text;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  return fallback;
}

/** Log interno sin secretos: sólo código y mensaje del error y el contexto. */
export function logServerError(context: string, error: unknown): void {
  const e = error as { code?: string; message?: string } | undefined;
  console.error(`[winter-arc] ${context}`, { code: e?.code, message: e?.message?.slice(0, 300) });
}

export function fail(error: DbError, context: string, fallback?: string): ActionResult<never> {
  logServerError(context, error);
  return { ok: false, error: dbErrorMessage(error, fallback), code: error?.code };
}
