/**
 * Tests de integración + abuso contra un stack Supabase real (Auth + PostgREST + Postgres).
 * Cada test intenta explícitamente saltarse permisos (IDOR, escalada vertical/horizontal,
 * manipulación de IDs, fuerza bruta de invitaciones…) y verifica que la BD lo impide.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, createUser, todayIn, type TestUser } from "./helpers";

let alice: TestUser; // admin del grupo
let bob: TestUser; // miembro
let carol: TestUser; // ajena al grupo
let groupId: string;
let inviteCode: string;
let habitIds: { id: string; name: string; frequency: string; weekdays: number[] }[];
const TZ = "Europe/Madrid";

async function dailyHabitId(user: TestUser = alice) {
  const { data } = await user.client
    .from("habits")
    .select("id")
    .eq("group_id", groupId)
    .eq("frequency", "daily")
    .order("sort_order")
    .limit(1)
    .single();
  return data!.id as string;
}

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([createUser("alice"), createUser("bob"), createUser("carol")]);

  const { data, error } = await alice.client.rpc("create_group", {
    p_name: "WINTER ARC TEST",
    p_description: "grupo de pruebas",
  });
  expect(error).toBeNull();
  groupId = data as string;

  const { data: invites } = await alice.client.from("group_invitations").select("code").eq("group_id", groupId);
  inviteCode = invites![0].code;

  const { data: joined, error: joinError } = await bob.client.rpc("join_group", {
    // El código se normaliza: minúsculas y guiones se aceptan.
    p_code: `${inviteCode.slice(0, 4).toLowerCase()}-${inviteCode.slice(4, 8)}-${inviteCode.slice(8)}`,
  });
  expect(joinError).toBeNull();
  expect(joined).toEqual([{ status: "joined", group_id: groupId }]);

  const { data: habits } = await alice.client
    .from("habits")
    .select("id,name,frequency,weekdays")
    .eq("group_id", groupId)
    .order("sort_order");
  habitIds = habits as typeof habitIds;
});

describe("registro de usuario", () => {
  it("crea perfil y preferencias automáticamente", async () => {
    const { data: profile } = await alice.client.from("profiles").select("*").eq("id", alice.id).single();
    expect(profile!.display_name).toBe("alice");
    expect(profile!.username).toMatch(/^alice_/);
    expect(profile!.timezone).toBe(TZ);
    const { data: settings } = await alice.client.from("user_settings").select("*").eq("user_id", alice.id).single();
    expect(settings!.share_habits).toBe(true);
    expect(settings!.active_group_id).toBe(groupId);
  });

  it("usa un username alternativo si el pedido ya existe", async () => {
    const { data: aliceProfile } = await alice.client.from("profiles").select("username").eq("id", alice.id).single();
    const client = anonClient();
    const { data } = await client.auth.signUp({
      email: `dup.${Date.now()}@test.winterarc.local`,
      password: "Dup-password-123",
      options: { data: { username: aliceProfile!.username, display_name: "dup" } },
    });
    const { data: dupProfile } = await client.from("profiles").select("username").eq("id", data.user!.id).single();
    expect(dupProfile!.username).not.toBe(aliceProfile!.username);
    expect(dupProfile!.username).toMatch(/^user_[0-9a-f]{10}$/);
  });

  it("username_available refleja la disponibilidad", async () => {
    const { data: aliceProfile } = await alice.client.from("profiles").select("username").eq("id", alice.id).single();
    const anon = anonClient();
    expect((await anon.rpc("username_available", { p_username: aliceProfile!.username })).data).toBe(false);
    expect((await anon.rpc("username_available", { p_username: "zz_free_name_42" })).data).toBe(true);
    expect((await anon.rpc("username_available", { p_username: "Bad Name!" })).data).toBe(false);
  });
});

describe("grupos y hábitos iniciales", () => {
  it("siembra los 9 hábitos del Winter Arc", () => {
    expect(habitIds.map((h) => h.name)).toEqual([
      "Entrenamiento",
      "Boxeo",
      "Movilidad / estiramientos",
      "Trabajo físico / activación",
      "Reflexión diaria",
      "Lectura",
      "Actitud positiva",
      "Estudio",
      "Proyecto Google AdSense",
    ]);
    expect(habitIds.find((h) => h.name === "Boxeo")!.weekdays).toEqual([2, 4, 6]);
  });

  it("el creador es admin y el invitado miembro", async () => {
    const { data } = await bob.client.from("group_members").select("user_id,role").eq("group_id", groupId);
    const roles = Object.fromEntries(data!.map((m) => [m.user_id, m.role]));
    expect(roles[alice.id]).toBe("admin");
    expect(roles[bob.id]).toBe("member");
  });

  it("unirse dos veces es idempotente", async () => {
    const { data, error } = await bob.client.rpc("join_group", { p_code: inviteCode });
    expect(error).toBeNull();
    expect(data).toEqual([{ status: "already_member", group_id: groupId }]);
  });
});

describe("aislamiento: usuario ajeno al grupo", () => {
  it("no ve el grupo, hábitos, miembros, invitaciones ni registros", async () => {
    await alice.client.rpc("set_habit_status", { p_habit_id: await dailyHabitId(), p_date: todayIn(TZ), p_status: "done" });
    for (const table of ["groups", "habits", "group_members", "group_invitations", "habit_logs"] as const) {
      const column = table === "groups" ? "id" : "group_id";
      const { data, error } = await carol.client.from(table).select("*").eq(column, groupId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("no ve perfiles de gente con la que no comparte grupo", async () => {
    const { data } = await carol.client.from("profiles").select("id").eq("id", alice.id);
    expect(data).toEqual([]);
  });

  it("no puede registrar hábitos de un grupo ajeno", async () => {
    const { error } = await carol.client.rpc("set_habit_status", {
      p_habit_id: await dailyHabitId(),
      p_date: todayIn(TZ),
      p_status: "done",
    });
    expect(error).not.toBeNull();
  });

  it("no puede pedir estadísticas ni entrenamientos del grupo", async () => {
    const { data } = await carol.client.rpc("daily_stats", { p_group_id: groupId, p_from: todayIn(TZ, -3), p_to: todayIn(TZ) });
    expect(data).toEqual([]);
    const { error } = await carol.client.rpc("group_workout_summary", { p_group_id: groupId, p_from: todayIn(TZ, -3), p_to: todayIn(TZ) });
    expect(error?.code).toBe("WA403");
  });

  it("no puede fijar como grupo activo un grupo ajeno", async () => {
    const { error } = await carol.client.from("user_settings").update({ active_group_id: groupId }).eq("user_id", carol.id);
    expect(error?.code).toBe("WA403");
  });
});

describe("escalada vertical: miembro normal contra funciones de admin", () => {
  it("no ve invitaciones ni puede crearlas o revocarlas", async () => {
    const { data } = await bob.client.from("group_invitations").select("*").eq("group_id", groupId);
    expect(data).toEqual([]);
    const { error } = await bob.client.rpc("create_invitation", { p_group_id: groupId });
    expect(error?.code).toBe("WA403");
    const { data: inv } = await alice.client.from("group_invitations").select("id").eq("group_id", groupId).limit(1).single();
    const { error: revokeError } = await bob.client.rpc("revoke_invitation", { p_invitation_id: inv!.id });
    expect(revokeError?.code).toBe("WA403");
  });

  it("no puede autopromoverse ni tocar group_members directamente", async () => {
    const { error } = await bob.client.rpc("set_member_role", { p_group_id: groupId, p_user_id: bob.id, p_role: "admin" });
    expect(error?.code).toBe("WA403");
    const { error: updError } = await bob.client
      .from("group_members")
      .update({ role: "admin" })
      .eq("group_id", groupId)
      .eq("user_id", bob.id);
    expect(updError).not.toBeNull();
    const { error: insError } = await carol.client.from("group_members").insert({ group_id: groupId, user_id: carol.id });
    expect(insError).not.toBeNull();
  });

  it("no puede crear, editar ni archivar hábitos", async () => {
    const { error: insError } = await bob.client.from("habits").insert({ group_id: groupId, name: "hack" });
    expect(insError).not.toBeNull();
    const { data: upd } = await bob.client.from("habits").update({ name: "hack" }).eq("id", habitIds[0].id).select();
    expect(upd ?? []).toEqual([]);
  });

  it("no puede modificar la configuración del grupo ni expulsar", async () => {
    const { data } = await bob.client.from("groups").update({ name: "pwned" }).eq("id", groupId).select();
    expect(data ?? []).toEqual([]);
    const { error } = await bob.client.rpc("remove_member", { p_group_id: groupId, p_user_id: alice.id });
    expect(error?.code).toBe("WA403");
    const { error: delError } = await bob.client.rpc("delete_group", { p_group_id: groupId });
    expect(delError?.code).toBe("WA403");
  });

  it("no puede escribir columnas protegidas (created_by, deleted_at)", async () => {
    const { error } = await alice.client.from("groups").update({ created_by: bob.id }).eq("id", groupId);
    expect(error).not.toBeNull();
    const { error: delErr } = await alice.client.from("groups").update({ deleted_at: new Date().toISOString() }).eq("id", groupId);
    expect(delErr).not.toBeNull();
  });

  it("no puede autootorgarse logros", async () => {
    const { error } = await bob.client.from("user_achievements").insert({ user_id: bob.id, achievement_code: "arc_complete" });
    expect(error).not.toBeNull();
  });
});

describe("escalada horizontal / IDOR sobre datos personales", () => {
  it("no puede crear registros en nombre de otro usuario", async () => {
    const { error } = await bob.client
      .from("habit_logs")
      .insert({ user_id: alice.id, habit_id: await dailyHabitId(), log_date: todayIn(TZ), status: "done" });
    expect(error).not.toBeNull();
  });

  it("no puede modificar ni borrar registros de otro usuario", async () => {
    const { data: aliceLog } = await alice.client
      .from("habit_logs")
      .select("id")
      .eq("user_id", alice.id)
      .limit(1)
      .single();
    const { data: upd } = await bob.client.from("habit_logs").update({ status: "missed" }).eq("id", aliceLog!.id).select();
    expect(upd ?? []).toEqual([]);
    const { data: del } = await bob.client.from("habit_logs").delete().eq("id", aliceLog!.id).select();
    expect(del ?? []).toEqual([]);
    const { data: still } = await alice.client.from("habit_logs").select("status").eq("id", aliceLog!.id).single();
    expect(still!.status).toBe("done");
  });

  it("no puede cambiar user_id/group_id de un registro propio (mass assignment)", async () => {
    const { data: log } = await bob.client.rpc("set_habit_status", {
      p_habit_id: await dailyHabitId(bob),
      p_date: todayIn(TZ),
      p_status: "done",
    });
    const { error } = await bob.client.from("habit_logs").update({ user_id: alice.id }).eq("id", log.id);
    expect(error).not.toBeNull();
    const { error: gErr } = await bob.client.from("habit_logs").update({ group_id: groupId }).eq("id", log.id);
    expect(gErr).not.toBeNull();
  });

  it("las notas diarias son privadas incluso dentro del grupo", async () => {
    const { error } = await bob.client
      .from("daily_entries")
      .insert({ user_id: bob.id, entry_date: todayIn(TZ), did_today: "secreto de bob", improve_tomorrow: "" });
    expect(error).toBeNull();
    const { data } = await alice.client.from("daily_entries").select("*").eq("user_id", bob.id);
    expect(data).toEqual([]);
    const { error: spoof } = await alice.client
      .from("daily_entries")
      .insert({ user_id: bob.id, entry_date: todayIn(TZ, -1), did_today: "x" });
    expect(spoof).not.toBeNull();
  });

  it("los entrenamientos son privados; el grupo sólo ve agregados", async () => {
    const { error } = await bob.client
      .from("workouts")
      .insert({ user_id: bob.id, workout_date: todayIn(TZ), type: "boxing", duration_min: 60, feeling: 8, notes: "privado" });
    expect(error).toBeNull();
    const { data: raw } = await alice.client.from("workouts").select("*").eq("user_id", bob.id);
    expect(raw).toEqual([]);
    const { data: summary } = await alice.client.rpc("group_workout_summary", {
      p_group_id: groupId,
      p_from: todayIn(TZ, -7),
      p_to: todayIn(TZ),
    });
    const bobRow = (summary as { user_id: string; workouts: number; minutes: number }[]).find((r) => r.user_id === bob.id);
    expect(bobRow).toMatchObject({ workouts: 1, minutes: 60 });
  });

  it("no puede leer las preferencias de otro usuario", async () => {
    const { data } = await alice.client.from("user_settings").select("*").eq("user_id", bob.id);
    expect(data).toEqual([]);
  });

  it("no puede editar el perfil de otro usuario", async () => {
    const { data } = await bob.client.from("profiles").update({ display_name: "pwned" }).eq("id", alice.id).select();
    expect(data ?? []).toEqual([]);
  });
});

describe("privacidad configurable", () => {
  it("si un miembro deja de compartir hábitos, el grupo deja de verlos", async () => {
    const before = await alice.client.from("habit_logs").select("id").eq("user_id", bob.id);
    expect(before.data!.length).toBeGreaterThan(0);

    await bob.client.from("user_settings").update({ share_habits: false, share_workouts: false }).eq("user_id", bob.id);

    const after = await alice.client.from("habit_logs").select("id").eq("user_id", bob.id);
    expect(after.data).toEqual([]);
    const { data: stats } = await alice.client.rpc("daily_stats", { p_group_id: groupId, p_from: todayIn(TZ), p_to: todayIn(TZ) });
    expect((stats as { user_id: string }[]).some((s) => s.user_id === bob.id)).toBe(false);
    const { data: summary } = await alice.client.rpc("group_workout_summary", {
      p_group_id: groupId,
      p_from: todayIn(TZ, -7),
      p_to: todayIn(TZ),
    });
    expect((summary as { user_id: string }[]).some((s) => s.user_id === bob.id)).toBe(false);

    // Bob sigue viendo sus propios datos.
    const own = await bob.client.from("habit_logs").select("id").eq("user_id", bob.id);
    expect(own.data!.length).toBeGreaterThan(0);

    await bob.client.from("user_settings").update({ share_habits: true, share_workouts: true }).eq("user_id", bob.id);
  });
});

describe("validación de fechas y datos", () => {
  it("rechaza registros fuera de la ventana editable o en el futuro", async () => {
    const habit = await dailyHabitId(bob);
    const old = await bob.client.rpc("set_habit_status", { p_habit_id: habit, p_date: todayIn(TZ, -30), p_status: "done" });
    expect(old.error?.code).toBe("WA422");
    const future = await bob.client.rpc("set_habit_status", { p_habit_id: habit, p_date: todayIn(TZ, 5), p_status: "done" });
    expect(future.error?.code).toBe("WA422");
    const recent = await bob.client.rpc("set_habit_status", { p_habit_id: habit, p_date: todayIn(TZ, -2), p_status: "done" });
    expect(recent.error).toBeNull();
  });

  it("respeta la zona horaria del usuario (UTC+14)", async () => {
    const kiri = await createUser("kiri", "Pacific/Kiritimati");
    await kiri.client.rpc("join_group", { p_code: inviteCode });
    const { error } = await kiri.client.rpc("set_habit_status", {
      p_habit_id: await dailyHabitId(kiri),
      p_date: todayIn("Pacific/Kiritimati"),
      p_status: "done",
    });
    expect(error).toBeNull();
  });

  it("rechaza valores absurdos", async () => {
    const long = await bob.client.from("workouts").insert({
      user_id: bob.id,
      workout_date: todayIn(TZ),
      type: "gym",
      duration_min: 5000,
    });
    expect(long.error).not.toBeNull();
    const text = await bob.client
      .from("daily_entries")
      .upsert({ user_id: bob.id, entry_date: todayIn(TZ, -1), did_today: "x".repeat(2001) });
    expect(text.error).not.toBeNull();
    const tz = await bob.client.from("profiles").update({ timezone: "Mars/Olympus" }).eq("id", bob.id);
    expect(tz.error?.code).toBe("WA422");
    const badType = await bob.client.from("workouts").insert({
      user_id: bob.id,
      workout_date: todayIn(TZ),
      type: "hacking",
      duration_min: 10,
    });
    expect(badType.error).not.toBeNull();
  });

  it("no permite registrar hábitos desactivados", async () => {
    const habit = habitIds.find((h) => h.name === "Lectura")!.id;
    await alice.client.from("habits").update({ is_active: false }).eq("id", habit);
    const { error } = await bob.client.rpc("set_habit_status", { p_habit_id: habit, p_date: todayIn(TZ), p_status: "done" });
    expect(error?.code).toBe("WA422");
    await alice.client.from("habits").update({ is_active: true }).eq("id", habit);
  });
});

describe("invitaciones", () => {
  it("códigos: 12 caracteres sin ambigüedades", () => {
    expect(inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  });

  it("una invitación revocada o caducada no sirve", async () => {
    const { data: inv } = await alice.client.rpc("create_invitation", { p_group_id: groupId, p_expires_in_hours: 1, p_max_uses: 5 });
    await alice.client.rpc("revoke_invitation", { p_invitation_id: inv.id });
    const dave = await createUser("dave");
    const { data: joined } = await dave.client.rpc("join_group", { p_code: inv.code });
    expect(joined).toEqual([{ status: "revoked", group_id: null }]);
    const { data: preview } = await dave.client.rpc("get_invitation_preview", { p_code: inv.code });
    expect(preview[0]).toMatchObject({ status: "revoked", group_name: null });
  });

  it("respeta el número máximo de usos", async () => {
    const { data: inv } = await alice.client.rpc("create_invitation", { p_group_id: groupId, p_expires_in_hours: 24, p_max_uses: 1 });
    const erin = await createUser("erin");
    const frank = await createUser("frank");
    expect((await erin.client.rpc("join_group", { p_code: inv.code })).data[0].status).toBe("joined");
    expect((await frank.client.rpc("join_group", { p_code: inv.code })).data[0].status).toBe("exhausted");
  });

  it("limita la fuerza bruta de códigos", async () => {
    const mallory = await createUser("mallory");
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 12; i++) {
      const { data, error } = await mallory.client.rpc("join_group", { p_code: `AAAAAAAAAA${String(i).padStart(2, "2")}` });
      results.push(error?.code ?? data?.[0]?.status);
    }
    expect(results.slice(0, 10).every((r) => r === "invalid")).toBe(true);
    expect(results.slice(10).every((r) => r === "WA429")).toBe(true);
    // Ni siquiera un código válido pasa mientras dura el bloqueo.
    const { error } = await mallory.client.rpc("join_group", { p_code: inviteCode });
    expect(error?.code).toBe("WA429");
  });

  it("el preview no revela nada con un código inválido", async () => {
    const { data } = await carol.client.rpc("get_invitation_preview", { p_code: "ZZZZZZZZZZZZ" });
    expect(data[0]).toMatchObject({ status: "invalid", group_name: null, member_count: null });
  });

  it("usuarios anónimos no pueden usar la API de grupos", async () => {
    const anon = anonClient();
    expect((await anon.rpc("join_group", { p_code: inviteCode })).error).not.toBeNull();
    expect((await anon.rpc("get_invitation_preview", { p_code: inviteCode })).error).not.toBeNull();
    const { data, error } = await anon.from("groups").select("*");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    const { data: profiles, error: pErr } = await anon.from("profiles").select("*");
    expect(pErr !== null || (profiles ?? []).length === 0).toBe(true);
  });
});

describe("estadísticas", () => {
  it("daily_stats cuenta obligatorios, hechos, no aplicables y extra", async () => {
    const user = await createUser("stats");
    const { data: gid } = await user.client.rpc("create_group", { p_name: "stats group", p_start_date: todayIn(TZ, -10) });
    const { data: habits } = await user.client.from("habits").select("id,name,frequency,weekdays").eq("group_id", gid);
    const byName = (n: string) => habits!.find((h) => h.name === n)!.id;
    const today = todayIn(TZ);
    await user.client.rpc("set_habit_status", { p_habit_id: byName("Lectura"), p_date: today, p_status: "done" });
    await user.client.rpc("set_habit_status", { p_habit_id: byName("Movilidad / estiramientos"), p_date: today, p_status: "done" });
    await user.client.rpc("set_habit_status", { p_habit_id: byName("Actitud positiva"), p_date: today, p_status: "skipped" });
    await user.client.rpc("set_habit_status", { p_habit_id: byName("Entrenamiento"), p_date: today, p_status: "done" });

    const isoDow = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const scheduled = habits!.filter(
      (h) => h.frequency === "daily" || (h.frequency === "weekdays" && (h.weekdays as number[]).includes(isoDow)),
    ).length;

    const { data: stats } = await user.client.rpc("daily_stats", { p_group_id: gid, p_from: today, p_to: today });
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ required: scheduled - 1, completed: 2, skipped: 1, bonus: 1 });

    // Quitar el estado borra el registro.
    await user.client.rpc("set_habit_status", { p_habit_id: byName("Lectura"), p_date: today, p_status: null });
    const { data: again } = await user.client.rpc("daily_stats", { p_group_id: gid, p_from: today, p_to: today });
    expect(again[0].completed).toBe(1);
  });

  it("evaluate_my_achievements desbloquea logros reales", async () => {
    const { data } = await alice.client.rpc("evaluate_my_achievements");
    expect(data).toContain("first_day");
    const { data: mine } = await alice.client.from("user_achievements").select("achievement_code");
    expect(mine!.map((m) => m.achievement_code)).toContain("first_day");
    const { data: again } = await alice.client.rpc("evaluate_my_achievements");
    expect(again).toEqual([]);
  });
});

describe("gestión de miembros", () => {
  it("el último admin no puede irse dejando el grupo huérfano", async () => {
    const { error } = await alice.client.rpc("leave_group", { p_group_id: groupId });
    expect(error?.code).toBe("WA409");
  });

  it("transferir administración y expulsar funciona con permisos reales", async () => {
    const gina = await createUser("gina");
    await gina.client.rpc("join_group", { p_code: inviteCode });

    const { error: tErr } = await alice.client.rpc("transfer_admin", { p_group_id: groupId, p_user_id: bob.id });
    expect(tErr).toBeNull();
    // Alice ya no es admin.
    expect((await alice.client.rpc("remove_member", { p_group_id: groupId, p_user_id: gina.id })).error?.code).toBe("WA403");
    // Bob (nuevo admin) expulsa a Gina.
    expect((await bob.client.rpc("remove_member", { p_group_id: groupId, p_user_id: gina.id })).error).toBeNull();
    const { data } = await gina.client.from("groups").select("id").eq("id", groupId);
    expect(data).toEqual([]);
    // Devolver la administración.
    expect((await bob.client.rpc("transfer_admin", { p_group_id: groupId, p_user_id: alice.id })).error).toBeNull();
  });

  it("un admin no puede expulsar a otro admin", async () => {
    await alice.client.rpc("set_member_role", { p_group_id: groupId, p_user_id: bob.id, p_role: "admin" });
    const { error } = await alice.client.rpc("remove_member", { p_group_id: groupId, p_user_id: bob.id });
    expect(error?.code).toBe("WA409");
    await alice.client.rpc("set_member_role", { p_group_id: groupId, p_user_id: bob.id, p_role: "member" });
  });

  it("un grupo borrado desaparece para todos sus miembros", async () => {
    const owner = await createUser("owner");
    const { data: gid } = await owner.client.rpc("create_group", { p_name: "temporal", p_seed_defaults: false });
    expect((await owner.client.rpc("delete_group", { p_group_id: gid })).error).toBeNull();
    const { data } = await owner.client.from("groups").select("id").eq("id", gid);
    expect(data).toEqual([]);
  });
});

describe("cuenta", () => {
  it("delete_my_account borra al usuario y transfiere la administración", async () => {
    const leader = await createUser("leader");
    const follower = await createUser("follower");
    const { data: gid } = await leader.client.rpc("create_group", { p_name: "sucesion", p_seed_defaults: false });
    const { data: inv } = await leader.client.from("group_invitations").select("code").eq("group_id", gid).single();
    await follower.client.rpc("join_group", { p_code: inv!.code });

    expect((await leader.client.rpc("delete_my_account")).error).toBeNull();
    const { data } = await follower.client.from("group_members").select("user_id,role").eq("group_id", gid);
    expect(data).toEqual([{ user_id: follower.id, role: "admin" }]);
  });
});
