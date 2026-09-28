/**
 * Notificaciones por email: permisos de las funciones de lote, verificación de
 * email, baja con un clic, reserva idempotente y envío real al buzón SMTP local.
 */
import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createUser, todayIn, type TestUser } from "./helpers";
import { runNotifications } from "@/lib/notifications/run";

const MAILBOX = process.env.E2E_MAILBOX_URL ?? "http://127.0.0.1:54321/__mail";
const admin = adminClient();

let alice: TestUser;
let bob: TestUser;
let groupId: string;

async function mailsTo(email: string): Promise<{ raw: string }[]> {
  return (await (await fetch(`${MAILBOX}?to=${encodeURIComponent(email)}`)).json()) as { raw: string }[];
}

function decode(raw: string) {
  const latin1 = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return Buffer.from(latin1, "latin1").toString("utf8");
}

/** Un instante que en Madrid es domingo a las 20:30. */
function nextSundayEvening(): Date {
  const d = new Date();
  for (let i = 0; i < 8; i++) {
    const probe = new Date(d.getTime() + i * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(probe);
    if (weekday === "Sun") {
      const ymd = todayIn("Europe/Madrid", i);
      return new Date(`${ymd}T18:30:00Z`); // 19:30/20:30 en Madrid según horario de verano/invierno
    }
  }
  throw new Error("unreachable");
}

beforeAll(async () => {
  [alice, bob] = await Promise.all([createUser("nalice"), createUser("nbob")]);
  const { data } = await alice.client.rpc("create_group", { p_name: "Notif group", p_start_date: todayIn("Europe/Madrid", -3) });
  groupId = data as string;
  const { data: inv } = await alice.client.from("group_invitations").select("code").eq("group_id", groupId).single();
  await bob.client.rpc("join_group", { p_code: inv!.code });
});

describe("permisos", () => {
  it("un usuario normal no puede ejecutar las funciones del cron ni crear verificaciones", async () => {
    const claim = await alice.client.rpc("claim_notification_batch", { p_kind: "daily_reminder" });
    expect(claim.error).not.toBeNull();
    const finish = await alice.client.rpc("finish_notification", { p_user_id: alice.id, p_kind: "daily_reminder", p_period_key: "x", p_status: "sent" });
    expect(finish.error).not.toBeNull();
    const verify = await alice.client.rpc("admin_create_email_verification", { p_user_id: alice.id, p_email: "x@y.com", p_token_hash: "a".repeat(64) });
    expect(verify.error).not.toBeNull();
    const anonClaim = await anonClient().rpc("claim_notification_batch", { p_kind: "weekly_summary" });
    expect(anonClaim.error).not.toBeNull();
  });

  it("no se puede fijar un email de notificaciones sin verificarlo", async () => {
    const { error } = await alice.client
      .from("user_settings")
      .update({ notification_email: "victima@example.com", notification_email_verified_at: new Date().toISOString() })
      .eq("user_id", alice.id);
    expect(error).not.toBeNull();
  });

  it("los tokens de baja no son legibles por otros usuarios", async () => {
    const { data } = await bob.client.from("user_settings").select("unsubscribe_token").eq("user_id", alice.id);
    expect(data).toEqual([]);
  });
});

describe("verificación de email", () => {
  it("sólo el token correcto verifica el email", async () => {
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    const { error } = await admin.rpc("admin_create_email_verification", { p_user_id: bob.id, p_email: "Bob.Notif@Example.com", p_token_hash: hash });
    expect(error).toBeNull();

    const pending = await bob.client.rpc("my_notification_email");
    expect(pending.data[0]).toMatchObject({ pending_email: "bob.notif@example.com", notification_email: null });

    expect((await anonClient().rpc("verify_notification_email", { p_token: randomBytes(32).toString("base64url") })).data).toBe(false);
    expect((await anonClient().rpc("verify_notification_email", { p_token: "' or 1=1 --" })).data).toBe(false);
    expect((await anonClient().rpc("verify_notification_email", { p_token: token })).data).toBe(true);
    // Un solo uso.
    expect((await anonClient().rpc("verify_notification_email", { p_token: token })).data).toBe(false);

    const after = await bob.client.rpc("my_notification_email");
    expect(after.data[0]).toMatchObject({ notification_email: "bob.notif@example.com", verified: true, pending_email: null });

    await bob.client.rpc("use_account_email_for_notifications");
    const reset = await bob.client.rpc("my_notification_email");
    expect(reset.data[0].notification_email).toBeNull();
  });

  it("limita las solicitudes de verificación", async () => {
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 7; i++) {
      const { error } = await admin.rpc("admin_create_email_verification", {
        p_user_id: alice.id,
        p_email: `spam${i}@example.com`,
        p_token_hash: createHash("sha256").update(String(i)).digest("hex"),
      });
      results.push(error?.code);
    }
    expect(results.slice(0, 5).every((r) => r === undefined)).toBe(true);
    expect(results.slice(5).every((r) => r === "WA429")).toBe(true);
  });
});

describe("baja con un clic", () => {
  it("desactiva todos los emails con el token", async () => {
    const user = await createUser("unsub");
    await user.client.from("user_settings").update({ email_daily_reminder: true, email_weekly_summary: true }).eq("user_id", user.id);
    const { data: s } = await user.client.from("user_settings").select("unsubscribe_token").eq("user_id", user.id).single();
    expect((await anonClient().rpc("unsubscribe_emails", { p_token: s!.unsubscribe_token })).data).toBe(true);
    const { data: after } = await user.client.from("user_settings").select("email_daily_reminder, email_weekly_summary").eq("user_id", user.id).single();
    expect(after).toEqual({ email_daily_reminder: false, email_weekly_summary: false });
    expect((await anonClient().rpc("unsubscribe_emails", { p_token: "00000000-0000-4000-8000-000000000000" })).data).toBe(false);
  });
});

describe("envío", () => {
  it("recordatorio diario: sólo tras la hora elegida, una vez al día y sólo si quedan hábitos", async () => {
    await alice.client.from("user_settings").update({ email_daily_reminder: true, email_weekly_summary: false, reminder_time: "20:00" }).eq("user_id", alice.id);
    await bob.client.from("user_settings").update({ email_daily_reminder: true, email_weekly_summary: false, reminder_time: "20:00" }).eq("user_id", bob.id);

    // Bob marca todos sus hábitos obligatorios de hoy: no debe recibir recordatorio.
    const today = todayIn("Europe/Madrid");
    const { data: habits } = await bob.client.from("habits").select("id").eq("group_id", groupId);
    for (const h of habits ?? []) await bob.client.rpc("set_habit_status", { p_habit_id: h.id, p_date: today, p_status: "done" });

    const early = new Date(`${today}T10:00:00Z`); // 11:00/12:00 en Madrid
    const earlyRun = await runNotifications({ now: early });
    expect(earlyRun.daily_reminder.sent).toBe(0);

    const late = new Date(`${today}T20:30:00Z`); // 21:30/22:30 en Madrid
    const lateRun = await runNotifications({ now: late });
    expect(lateRun.daily_reminder.sent).toBeGreaterThanOrEqual(1);
    const aliceMails = await mailsTo(alice.email);
    const reminder = decode(aliceMails.at(-1)!.raw);
    expect(reminder).toContain("¿has completado tus hábitos de hoy?");
    expect(reminder).toContain("Lectura");
    expect(reminder).toContain("List-Unsubscribe");
    expect(await mailsTo(bob.email)).toHaveLength(0);

    // Segunda ejecución la misma noche: no duplica.
    const again = await runNotifications({ now: new Date(late.getTime() + 3600_000) });
    expect(again.daily_reminder.sent).toBe(0);
    expect(await mailsTo(alice.email)).toHaveLength(aliceMails.length);
  });

  it("resumen semanal: domingo por la tarde con estadísticas personales y del grupo", async () => {
    await alice.client.from("user_settings").update({ email_daily_reminder: false, email_weekly_summary: true }).eq("user_id", alice.id);
    await bob.client.from("user_settings").update({ email_daily_reminder: false, email_weekly_summary: true }).eq("user_id", bob.id);
    const before = (await mailsTo(bob.email)).length;

    const run = await runNotifications({ now: nextSundayEvening() });
    expect(run.weekly_summary.sent).toBeGreaterThanOrEqual(2);
    const mail = decode((await mailsTo(bob.email)).at(-1)!.raw);
    expect((await mailsTo(bob.email)).length).toBe(before + 1);
    expect(mail).toContain("Resumen semanal");
    expect(mail).toContain("Notif group");
    expect(mail).toContain("nalice");
    expect(mail).toContain("(tú)");
  });
});
