/**
 * Acceso sólo por invitación: la BD rechaza altas sin código válido, el alta con
 * invitación mete a la persona en el grupo y sólo los "creadores" crean grupos.
 */
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createUser, type TestUser } from "./helpers";

let owner: TestUser;
let groupId: string;
let code: string;

async function rawSignUp(meta: Record<string, string> = {}) {
  const email = `raw.${randomBytes(4).toString("hex")}@test.winterarc.local`;
  return anonClient().auth.signUp({ email, password: "Raw-pass-12345", options: { data: { display_name: "raw", ...meta } } });
}

beforeAll(async () => {
  owner = await createUser("owner");
  const { data } = await owner.client.rpc("create_group", { p_name: "Sólo invitados" });
  groupId = data as string;
  const { data: inv } = await owner.client.from("group_invitations").select("code").eq("group_id", groupId).single();
  code = inv!.code;
});

describe("registro sólo por invitación", () => {
  it("rechaza el registro sin invitación (aunque se llame a la API de Auth directamente)", async () => {
    const { data, error } = await rawSignUp();
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("rechaza códigos inventados, revocados o caducados", async () => {
    expect((await rawSignUp({ invite_code: "ZZZZZZZZZZZZ" })).error).not.toBeNull();
    const { data: inv } = await owner.client.rpc("create_invitation", { p_group_id: groupId, p_expires_in_hours: 1 });
    await owner.client.rpc("revoke_invitation", { p_invitation_id: inv.id });
    expect((await rawSignUp({ invite_code: inv.code })).error).not.toBeNull();
  });

  it("con invitación válida entra directamente en el grupo como miembro", async () => {
    const friend = await createUser("friend", "Europe/Madrid", { invite: `${code.slice(0, 4)}-${code.slice(4, 8).toLowerCase()}-${code.slice(8)}` });
    const { data: groups } = await friend.client.from("groups").select("id, name");
    expect(groups).toEqual([{ id: groupId, name: "Sólo invitados" }]);
    const { data: me } = await friend.client.from("group_members").select("role").eq("user_id", friend.id).single();
    expect(me!.role).toBe("member");
    const { data: settings } = await friend.client.from("user_settings").select("active_group_id").eq("user_id", friend.id).single();
    expect(settings!.active_group_id).toBe(groupId);
    const { data: profile } = await friend.client.from("profiles").select("can_create_groups").eq("id", friend.id).single();
    expect(profile!.can_create_groups).toBe(false);
  });

  it("un invitado no puede crear grupos ni autoconcederse el permiso", async () => {
    const friend = await createUser("friend2", "Europe/Madrid", { invite: code });
    const { error } = await friend.client.rpc("create_group", { p_name: "grupo pirata" });
    expect(error?.code).toBe("WA403");
    const { error: upd } = await friend.client.from("profiles").update({ can_create_groups: true }).eq("id", friend.id);
    expect(upd).not.toBeNull();
    const { error: allow } = await friend.client.rpc("admin_allow_signup", { p_email: "x@y.com" });
    expect(allow).not.toBeNull();
  });

  it("respeta el máximo de usos de la invitación", async () => {
    const { data: inv } = await owner.client.rpc("create_invitation", { p_group_id: groupId, p_max_uses: 1 });
    await createUser("once", "Europe/Madrid", { invite: inv.code });
    expect((await rawSignUp({ invite_code: inv.code })).error).not.toBeNull();
  });

  it("los emails autorizados por el propietario se registran como creadores", async () => {
    const email = `creator.${randomBytes(4).toString("hex")}@test.winterarc.local`;
    await adminClient().rpc("admin_allow_signup", { p_email: email.toUpperCase() });
    const client = anonClient();
    const { data, error } = await client.auth.signUp({ email, password: "Creator-pass-123" });
    expect(error).toBeNull();
    const { data: profile } = await client.from("profiles").select("can_create_groups").eq("id", data.user!.id).single();
    expect(profile!.can_create_groups).toBe(true);
  });

  it("la vista previa pública sólo revela el nombre del grupo con un código válido", async () => {
    const anon = anonClient();
    expect((await anon.rpc("invite_signup_preview", { p_code: code })).data[0]).toEqual({ status: "valid", group_name: "Sólo invitados" });
    expect((await anon.rpc("invite_signup_preview", { p_code: "ZZZZZZZZZZZZ" })).data[0]).toEqual({ status: "invalid", group_name: null });
  });
});
