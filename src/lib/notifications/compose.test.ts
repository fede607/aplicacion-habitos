import { describe, expect, it } from "vitest";
import { composeDailyReminder, composeWeeklySummary } from "./compose";

const base = {
  siteUrl: "https://wa.test",
  unsubscribeUrl: "https://wa.test/unsubscribe?token=abc",
};

describe("composeDailyReminder", () => {
  it("lista los hábitos pendientes, la racha y el enlace de baja", () => {
    const email = composeDailyReminder({
      ...base,
      to: "a@test.com",
      name: "Fede",
      pendingHabits: ["Lectura", "Estudio"],
      done: 3,
      required: 5,
      streak: 4,
    });
    expect(email.subject).toBe("Te quedan 2 hábitos hoy · 🔥 racha de 4");
    expect(email.html).toContain('<li style="margin:4px 0">Lectura</li>');
    expect(email.html).toContain("https://wa.test/today");
    expect(email.html).toContain("Darse de baja");
    expect(email.text).toContain("- Estudio");
    expect(email.unsubscribeUrl).toBe(base.unsubscribeUrl);
  });

  it("escapa HTML de nombres y hábitos (anti inyección)", () => {
    const email = composeDailyReminder({
      ...base,
      to: "a@test.com",
      name: '<img src=x onerror="alert(1)">',
      pendingHabits: ["<script>alert(1)</script>"],
      done: 0,
      required: 1,
      streak: 0,
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.subject).toBe("Te queda 1 hábito hoy");
  });
});

describe("composeWeeklySummary", () => {
  const input = {
    ...base,
    to: "a@test.com",
    name: "Fede",
    groupName: "YEAR ARC 2026",
    week: { completed: 30, required: 40, percent: 75 },
    streak: { current: 5, best: 9 },
    workouts: { count: 3, minutes: 200 },
    weeklyTargets: [{ name: "Entrenamiento", done: 4, target: 4 }],
    members: [
      { name: "Álex", weekPercent: 90, streak: 7, isMe: false },
      { name: "Fede", weekPercent: 75, streak: 5, isMe: true },
    ],
    collective: { done: 66, required: 80 },
    ranked: false,
    hiddenMembers: 1,
  };

  it("incluye estadísticas personales, del grupo y miembros privados", () => {
    const email = composeWeeklySummary(input);
    expect(email.subject).toBe("Tu semana en el Year Arc: 75% · 🔥 5");
    expect(email.html).toContain("30 / 40 (75%)");
    expect(email.html).toContain("3 h 20 min");
    expect(email.html).toContain("4 / 4 ✅");
    expect(email.html).toContain("66 de 80");
    expect(email.html).toContain("Fede (tú)");
    expect(email.html).toContain("1 miembro tiene sus estadísticas en privado");
    expect(email.text).toContain("- Álex: 90%");
  });

  it("numera sólo si la comparación está activada", () => {
    expect(composeWeeklySummary({ ...input, ranked: true }).text).toContain(
      "1. Álex",
    );
    expect(composeWeeklySummary(input).text).not.toContain("1. Álex");
  });
});
