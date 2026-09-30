import { describe, expect, it } from "vitest";
import { CAPTCHA_FAILED, signInErrorMessage, signUpErrorMessage } from "./auth-errors";

describe("mensajes de error de Auth", () => {
  it("distingue CAPTCHA de invitación aunque ambos lleguen como 500", () => {
    const captcha = { status: 500, code: "unexpected_failure", message: "captcha verification process failed" };
    expect(signUpErrorMessage(captcha).form).toBe(CAPTCHA_FAILED);
    expect(signInErrorMessage(captcha)).toBe(CAPTCHA_FAILED);
    const trigger = { status: 500, code: "unexpected_failure", message: "Database error saving new user" };
    expect(signUpErrorMessage(trigger).form).toMatch(/invitación/);
  });

  it("no revela si una cuenta existe", () => {
    expect(signInErrorMessage({ status: 400, code: "invalid_credentials" })).toBe("Email o contraseña incorrectos.");
    expect(signUpErrorMessage({ status: 422, code: "user_already_exists" }).form).not.toMatch(/existe ya/);
  });
});
