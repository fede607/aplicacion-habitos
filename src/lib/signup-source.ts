/** Origen de las altas (p. ej. «whatsapp») para medir qué campaña funciona. */
export const SOURCE_COOKIE = "ya_src";

export function cleanSource(raw: string | null | undefined): string | undefined {
  const s = (raw ?? "").toLowerCase().trim();
  return /^[a-z0-9_-]{1,32}$/.test(s) ? s : undefined;
}
