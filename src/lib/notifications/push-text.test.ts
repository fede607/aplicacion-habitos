import { describe, expect, it } from "vitest";
import { pushReminderText } from "./push-text";

describe("pushReminderText", () => {
  const p = { pending: ["Leer", "Entrenar"], challenges: ["Sin azúcar"], streak: 5 };
  it("por la mañana anima a empezar el día", () => {
    const t = pushReminderText("Ana López", "2026-11-02-am", p);
    expect(t.title).toBe("☀️ Buenos días, Ana");
    expect(t.body).toContain("Leer, Entrenar, reto «Sin azúcar»");
  });
  it("a la hora del recordatorio avisa de la racha", () => {
    expect(pushReminderText("Ana", "2026-11-02", p).title).toContain("racha de 5 días");
  });
  it("la última llamada insiste en lo que falta", () => {
    const t = pushReminderText("Ana", "2026-11-02-late", { pending: ["Leer"], challenges: [], streak: 0 });
    expect(t.title).toBe("🌙 Última llamada, Ana");
    expect(t.body).toContain("Aún te falta: Leer");
  });
});
