import { describe, expect, it } from "vitest";
import {
  createGroupSchema,
  habitSchema,
  inviteCodeSchema,
  registerSchema,
  safeNextPath,
  workoutSchema,
} from "./validation";

describe("safeNextPath (anti open-redirect)", () => {
  it.each([
    ["/today", "/today"],
    ["/join/ABCDEFGHJKLM", "/join/ABCDEFGHJKLM"],
    ["https://evil.com", "/today"],
    ["//evil.com", "/today"],
    ["/\\evil.com", "/today"],
    ["javascript:alert(1)", "/today"],
    ["/ok\r\nSet-Cookie: x", "/today"],
    [null, "/today"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input as string | null)).toBe(expected);
  });
});

describe("inviteCodeSchema", () => {
  it("normaliza guiones, espacios y minúsculas", () => {
    expect(inviteCodeSchema.parse("abcd-efgh-jkmn")).toBe("ABCDEFGHJKMN");
    expect(inviteCodeSchema.parse(" ABCD EFGH JKMN ")).toBe("ABCDEFGHJKMN");
  });
  it("rechaza longitudes o caracteres ambiguos", () => {
    expect(inviteCodeSchema.safeParse("ABC").success).toBe(false);
    expect(inviteCodeSchema.safeParse("ABCDEFGHIJKL").success).toBe(false); // contiene I
    expect(inviteCodeSchema.safeParse("ABCDEFGH0JKL").success).toBe(false); // contiene 0
  });
});

describe("workoutSchema", () => {
  const base = { date: "2026-09-28", type: "boxing", durationMin: "60", intensity: "", feeling: "8", exercises: "", notes: "", nextGoal: "" };
  it("acepta un entrenamiento válido y convierte números", () => {
    const r = workoutSchema.parse(base);
    expect(r).toMatchObject({ durationMin: 60, feeling: 8, intensity: null });
  });
  it.each([
    [{ durationMin: "0" }],
    [{ durationMin: "601" }],
    [{ durationMin: "abc" }],
    [{ feeling: "11" }],
    [{ type: "hacking" }],
    [{ date: "2026-13-01" }],
    [{ notes: "x".repeat(2001) }],
  ])("rechaza %o", (patch) => {
    expect(workoutSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = { email: "Test@Example.com", password: "abc12345", displayName: " Fede ", username: "Fede_01", timezone: "Europe/Madrid" };
  it("normaliza email/username y recorta el nombre", () => {
    expect(registerSchema.parse(base)).toMatchObject({ email: "test@example.com", username: "fede_01", displayName: "Fede" });
  });
  it("exige contraseña con letras y números", () => {
    expect(registerSchema.safeParse({ ...base, password: "abcdefgh" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "12345678" }).success).toBe(false);
  });
  it("zona horaria inválida cae al valor por defecto", () => {
    expect(registerSchema.parse({ ...base, timezone: "Mars/Base" }).timezone).toBe("Europe/Madrid");
  });
  it("username inválido", () => {
    expect(registerSchema.safeParse({ ...base, username: "a b" }).success).toBe(false);
  });
});

describe("habitSchema", () => {
  const base = {
    groupId: "3f2b2c1e-8f1a-4c5e-9b1a-2d3e4f5a6b7c",
    name: "Boxeo",
    description: "",
    icon: "swords",
    category: "physical",
    color: "#ef4444",
    frequency: "weekdays",
    weekdays: [2, 4],
    weeklyTarget: null,
    isOptional: false,
    goal: "",
    startsOn: "2026-09-28",
  };
  it("días concretos requiere al menos un día", () => {
    expect(habitSchema.safeParse(base).success).toBe(true);
    expect(habitSchema.safeParse({ ...base, weekdays: [] }).success).toBe(false);
  });
  it("objetivo semanal requiere objetivo", () => {
    expect(habitSchema.safeParse({ ...base, frequency: "weekly_target", weeklyTarget: null }).success).toBe(false);
    expect(habitSchema.safeParse({ ...base, frequency: "weekly_target", weeklyTarget: 3 }).success).toBe(true);
  });
  it("rechaza iconos o colores arbitrarios (inyección)", () => {
    expect(habitSchema.safeParse({ ...base, icon: "<script>" }).success).toBe(false);
    expect(habitSchema.safeParse({ ...base, color: "red;background:url(x)" }).success).toBe(false);
  });
});

describe("createGroupSchema", () => {
  it("la fecha de fin debe ser posterior", () => {
    const base = { name: "WINTER ARC 2026", description: "", startDate: "2026-10-01", endDate: "2026-12-30", seedDefaults: true };
    expect(createGroupSchema.safeParse(base).success).toBe(true);
    expect(createGroupSchema.safeParse({ ...base, endDate: "2026-09-01" }).success).toBe(false);
  });
});
