import { inviteCodeSchema } from "./validation";

/** Extrae un código de invitación de `?invite=` o de `?next=/join/CODIGO`. */
export function inviteFromParams(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const direct = typeof params.invite === "string" ? params.invite : null;
  const fromNext =
    typeof params.next === "string"
      ? params.next.match(/^\/join\/([^/?#]+)/)?.[1]
      : null;
  const raw = direct ?? (fromNext ? decodeURIComponent(fromNext) : null);
  if (!raw) return null;
  const parsed = inviteCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
