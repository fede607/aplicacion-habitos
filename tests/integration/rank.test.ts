/**
 * Capa de BD del sistema de rangos: pesos, historial de versiones de hábitos
 * (el pasado no se reescribe) y RLS del histórico de rangos.
 */
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, todayIn, type TestUser } from "./helpers";

/** SQL directo sobre el Postgres local de pruebas (sólo para simular el paso del tiempo). */
const PG_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54322/postgres";
function psql(sql: string): boolean {
  try {
    execFileSync("psql", [PG_URL, "-qtAc", sql], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const canPsql = psql("select 1");

const TZ = "Europe/Madrid";
let alice: TestUser; // admin
let bob: TestUser; // miembro
let carol: TestUser; // ajena al grupo
let groupId: string;

function snapshot(userId: string, date: string, over: Record<string, unknown> = {}) {
  return {
    user_id: userId,
    group_id: groupId,
    snapshot_date: date,
    daily_score: 80,
    discipline_score: 55.5,
    tier_index: 12,
    phase: "provisional",
    current_streak: 1,
    best_streak: 1,
    consistency: 100,
    category_scores: {},
    components: {},
    inputs: { required: 5, done: 4, weights: {}, completed: [] },
    algorithm_version: 1,
    ...over,
  };
}

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([createUser("alice"), createUser("bob"), createUser("carol")]);
  const { data, error } = await alice.client.rpc("create_group", { p_name: "RANK TEST", p_description: "" });
  expect(error).toBeNull();
  groupId = data as string;
  const { data: invites } = await alice.client.from("group_invitations").select("code").eq("group_id", groupId);
  const { error: joinError } = await bob.client.rpc("join_group", { p_code: invites![0].code });
  expect(joinError).toBeNull();
});

describe("pesos de hábitos", () => {
  it("la plantilla marca como exigentes entrenar, dormir y estudiar", async () => {
    const { data } = await alice.client.from("habits").select("name, weight").eq("group_id", groupId);
    const byName = Object.fromEntries(data!.map((h) => [h.name, Number(h.weight)]));
    expect(byName["Entrenamiento"]).toBe(1.5);
    expect(byName["Dormir 7-8 horas"]).toBe(1.5);
    expect(byName["Aprendizaje / estudio"]).toBe(1.5);
    expect(byName["Lectura"]).toBe(1);
  });

  it("sólo admite 1, 1,5 o 2 y sólo el admin lo cambia", async () => {
    const { data: h } = await alice.client.from("habits").select("id").eq("group_id", groupId).eq("name", "Lectura").single();
    const bad = await alice.client.from("habits").update({ weight: 3 }).eq("id", h!.id);
    expect(bad.error).not.toBeNull();
    const byMember = await bob.client.from("habits").update({ weight: 2 }).eq("id", h!.id).select("id");
    expect(byMember.data ?? []).toHaveLength(0);
  });
});

describe("historial de versiones de hábitos", () => {
  it("existe una versión base para cada hábito y sólo la ven los miembros", async () => {
    const { data: habits } = await alice.client.from("habits").select("id").eq("group_id", groupId);
    const { data: revs } = await bob.client.from("habit_revisions").select("habit_id, effective_from").eq("group_id", groupId);
    expect(revs!.filter((r) => r.effective_from === "1970-01-01")).toHaveLength(habits!.length);
    const { data: outsider } = await carol.client.from("habit_revisions").select("habit_id").eq("group_id", groupId);
    expect(outsider).toEqual([]);
  });

  it.skipIf(!canPsql)("un cambio de peso en un hábito antiguo se aplica desde mañana; desactivar, desde hoy", async () => {
    const { data: old, error } = await alice.client
      .from("habits")
      .insert({ group_id: groupId, name: "Antiguo", icon: "check", starts_on: todayIn(TZ, -10) })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(psql(`set session_replication_role = replica; update public.habits set created_at = now() - interval '10 days' where id = '${old!.id}'`)).toBe(true);

    const w = await alice.client.from("habits").update({ weight: 2 }).eq("id", old!.id).select("id");
    expect(w.error).toBeNull();
    const off = await alice.client.from("habits").update({ is_active: false }).eq("id", old!.id).select("id");
    expect(off.error).toBeNull();

    const { data: revs } = await alice.client
      .from("habit_revisions")
      .select("effective_from, weight, is_active")
      .eq("habit_id", old!.id)
      .order("effective_from");
    expect(revs!.map((r) => [r.effective_from, Number(r.weight), r.is_active])).toEqual([
      ["1970-01-01", 1, true],
      [todayIn(TZ), 1, false], // hoy: peso anterior (el nuevo aún no aplica), ya desactivado
      [todayIn(TZ, 1), 2, false], // mañana: peso nuevo y sigue desactivado
    ]);
  });

  it("los cambios que no afectan al cálculo no crean versiones", async () => {
    const { data: h } = await alice.client.from("habits").select("id").eq("group_id", groupId).eq("name", "Hidratación").single();
    const before = await alice.client.from("habit_revisions").select("effective_from").eq("habit_id", h!.id);
    await alice.client.from("habits").update({ goal: "3 L", color: "#22c55e" }).eq("id", h!.id);
    const after = await alice.client.from("habit_revisions").select("effective_from").eq("habit_id", h!.id);
    expect(after.data).toHaveLength(before.data!.length);
  });
});

describe("histórico de rangos (rank_snapshots)", () => {
  it("cada uno guarda el suyo, dentro de la ventana de edición", async () => {
    const ok = await bob.client.from("rank_snapshots").upsert(snapshot(bob.id, todayIn(TZ)));
    expect(ok.error).toBeNull();
    const again = await bob.client.from("rank_snapshots").upsert(snapshot(bob.id, todayIn(TZ), { discipline_score: 56 }));
    expect(again.error).toBeNull();
    const { data } = await bob.client.from("rank_snapshots").select("discipline_score").eq("user_id", bob.id);
    expect(data).toHaveLength(1);
    expect(Number(data![0].discipline_score)).toBe(56);
  });

  it("no se puede escribir el de otro ni reescribir el pasado", async () => {
    const other = await bob.client.from("rank_snapshots").insert(snapshot(alice.id, todayIn(TZ)));
    expect(other.error).not.toBeNull();
    const old = await bob.client.from("rank_snapshots").insert(snapshot(bob.id, todayIn(TZ, -30)));
    expect(old.error).not.toBeNull();
    const future = await bob.client.from("rank_snapshots").insert(snapshot(bob.id, todayIn(TZ, 5)));
    expect(future.error).not.toBeNull();
    const outsider = await carol.client.from("rank_snapshots").insert(snapshot(carol.id, todayIn(TZ)));
    expect(outsider.error).not.toBeNull();
  });

  it("rechaza scores o rangos imposibles", async () => {
    for (const bad of [{ discipline_score: 150 }, { discipline_score: -1 }, { tier_index: 30 }, { phase: "legendary" }]) {
      const res = await bob.client.from("rank_snapshots").upsert(snapshot(bob.id, todayIn(TZ, -1), bad));
      expect(res.error).not.toBeNull();
    }
  });

  it("el grupo lo ve si compartes hábitos; alguien ajeno, nunca", async () => {
    const { data: asAdmin } = await alice.client.from("rank_snapshots").select("user_id").eq("user_id", bob.id);
    expect(asAdmin).toHaveLength(1);
    const { data: asOutsider } = await carol.client.from("rank_snapshots").select("user_id").eq("user_id", bob.id);
    expect(asOutsider).toEqual([]);
    await bob.client.from("user_settings").update({ share_habits: false }).eq("user_id", bob.id);
    const { data: hidden } = await alice.client.from("rank_snapshots").select("user_id").eq("user_id", bob.id);
    expect(hidden).toEqual([]);
    await bob.client.from("user_settings").update({ share_habits: true }).eq("user_id", bob.id);
  });

  it("no se pueden borrar", async () => {
    await bob.client.from("rank_snapshots").delete().eq("user_id", bob.id);
    const { data } = await bob.client.from("rank_snapshots").select("user_id").eq("user_id", bob.id);
    expect(data).toHaveLength(1);
  });
});
