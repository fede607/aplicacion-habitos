import "server-only";
import { createAdminClient } from "../supabase/admin";
import { sendEmail, type OutgoingEmail } from "../email/mailer";
import { getSiteUrl } from "../env";
import { logServerError } from "../errors";
import { addDays, startOfIsoWeek, type IsoDate } from "../dates";
import { computeStreaks, isRequiredOn, summarize, weeklyTargetProgress, type DayStat } from "../stats";
import { statsFrom } from "../data/stats-range";
import type { GroupRow, HabitLogStatus, HabitRow, NotificationKind } from "../database.types";
import { composeDailyReminder, composeWeeklySummary } from "./compose";

type Admin = ReturnType<typeof createAdminClient>;
type Claim = {
  user_id: string;
  email: string;
  display_name: string;
  timezone: string;
  group_id: string;
  local_date: string;
  period_key: string;
  unsubscribe_token: string;
};

type GroupContext = {
  group: GroupRow;
  habits: HabitRow[];
  members: { userId: string; name: string; shares: boolean; inComparison: boolean }[];
  series: Map<string, DayStat[]>;
  from: IsoDate;
};

export type RunResult = Record<NotificationKind, { sent: number; skipped: number; failed: number }> & { lastError?: string };

/** Motivo del fallo sin datos sensibles (código SMTP/nodemailer o primera línea del mensaje). */
function describeError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string } | undefined;
  const parts = [err?.code, err?.responseCode, err?.message?.split("\n")[0]?.slice(0, 120)].filter(Boolean);
  return parts.join(" · ") || "unknown";
}

/**
 * Procesa los envíos pendientes. Idempotente: la BD reserva cada
 * (usuario, tipo, periodo) antes de enviar, así que un cron repetido no duplica.
 */
export async function runNotifications(options: { now?: Date; limit?: number } = {}): Promise<RunResult> {
  const admin = createAdminClient();
  const now = options.now ?? new Date();
  const siteUrl = getSiteUrl();
  const result: RunResult = {
    daily_reminder: { sent: 0, skipped: 0, failed: 0 },
    weekly_summary: { sent: 0, skipped: 0, failed: 0 },
  };
  const cache = new Map<string, Promise<GroupContext | null>>();
  const loadGroup = (groupId: string, today: IsoDate) => {
    const key = `${groupId}:${today}`;
    if (!cache.has(key)) cache.set(key, loadGroupContext(admin, groupId, today));
    return cache.get(key)!;
  };

  for (const kind of ["daily_reminder", "weekly_summary"] as const) {
    const { data: batch, error } = await admin.rpc("claim_notification_batch", {
      p_kind: kind,
      p_now: now.toISOString(),
      p_limit: options.limit ?? 200,
    });
    if (error) {
      logServerError(`claim_notification_batch:${kind}`, error);
      continue;
    }
    for (const claim of batch ?? []) {
      let status: "sent" | "skipped" | "failed" = "failed";
      try {
        const ctx = await loadGroup(claim.group_id, claim.local_date);
        const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${claim.unsubscribe_token}`;
        const email = ctx
          ? kind === "daily_reminder"
            ? await buildDaily(admin, claim, ctx, siteUrl, unsubscribeUrl)
            : await buildWeekly(admin, claim, ctx, siteUrl, unsubscribeUrl)
          : null;
        if (email) {
          await sendEmail(email);
          status = "sent";
        } else {
          status = "skipped";
        }
      } catch (e) {
        logServerError(`notification:${kind}`, e);
        result.lastError = `${kind}: ${describeError(e)}`;
      }
      result[kind][status] += 1;
      const { error: finishError } = await admin.rpc("finish_notification", {
        p_user_id: claim.user_id,
        p_kind: kind,
        p_period_key: claim.period_key,
        p_status: status,
      });
      if (finishError) logServerError("finish_notification", finishError);
    }
  }
  return result;
}

async function loadGroupContext(admin: Admin, groupId: string, today: IsoDate): Promise<GroupContext | null> {
  const { data: group } = await admin.from("groups").select("*").eq("id", groupId).is("deleted_at", null).maybeSingle();
  if (!group) return null;
  const from = statsFrom(group.start_date, today);
  const [habitsRes, membersRes, statsRes] = await Promise.all([
    admin.from("habits").select("*").eq("group_id", groupId).eq("is_active", true).is("archived_at", null).order("sort_order"),
    admin.from("group_members").select("user_id").eq("group_id", groupId),
    admin.rpc("daily_stats", { p_group_id: groupId, p_from: from, p_to: today }),
  ]);
  const ids = (membersRes.data ?? []).map((m) => m.user_id);
  const [profilesRes, settingsRes] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", ids),
    admin.from("user_settings").select("user_id, share_habits, show_in_comparison").in("user_id", ids),
  ]);
  const names = new Map((profilesRes.data ?? []).map((p) => [p.id, p.display_name]));
  const prefs = new Map((settingsRes.data ?? []).map((s) => [s.user_id, s]));
  const series = new Map<string, DayStat[]>();
  for (const r of statsRes.data ?? []) {
    const list = series.get(r.user_id) ?? [];
    list.push({ day: r.day, required: r.required, completed: r.completed, skipped: r.skipped, bonus: r.bonus });
    series.set(r.user_id, list);
  }
  return {
    group,
    habits: habitsRes.data ?? [],
    from,
    series,
    members: ids.map((id) => ({
      userId: id,
      name: names.get(id) ?? "Miembro",
      shares: prefs.get(id)?.share_habits ?? false,
      inComparison: prefs.get(id)?.show_in_comparison ?? false,
    })),
  };
}

async function buildDaily(admin: Admin, claim: Claim, ctx: GroupContext, siteUrl: string, unsubscribeUrl: string): Promise<OutgoingEmail | null> {
  const today = claim.local_date;
  const required = ctx.habits.filter((h) => isRequiredOn(h, today));
  if (required.length === 0) return null;
  const { data: logs } = await admin
    .from("habit_logs")
    .select("habit_id, status")
    .eq("user_id", claim.user_id)
    .eq("group_id", ctx.group.id)
    .eq("log_date", today);
  const byHabit = new Map((logs ?? []).map((l) => [l.habit_id, l.status]));
  const pending = required.filter((h) => !byHabit.has(h.id));
  if (pending.length === 0) return null; // ya lo ha registrado todo: no molestar
  const counted = required.filter((h) => byHabit.get(h.id) !== "skipped");
  const done = counted.filter((h) => byHabit.get(h.id) === "done").length;
  const streak = computeStreaks(ctx.series.get(claim.user_id) ?? [], ctx.group.streak_threshold, today).current;
  return composeDailyReminder({
    to: claim.email,
    name: claim.display_name,
    pendingHabits: pending.map((h) => h.name),
    done,
    required: counted.length,
    streak,
    siteUrl,
    unsubscribeUrl,
  });
}

async function buildWeekly(admin: Admin, claim: Claim, ctx: GroupContext, siteUrl: string, unsubscribeUrl: string): Promise<OutgoingEmail> {
  const today = claim.local_date;
  const weekStart = startOfIsoWeek(today) < ctx.from ? ctx.from : startOfIsoWeek(today);
  const threshold = ctx.group.streak_threshold;
  const mySeries = ctx.series.get(claim.user_id) ?? [];

  const [workoutsRes, logsRes] = await Promise.all([
    admin.from("workouts").select("duration_min").eq("user_id", claim.user_id).gte("workout_date", startOfIsoWeek(today)).lte("workout_date", today),
    admin
      .from("habit_logs")
      .select("habit_id, log_date, status")
      .eq("user_id", claim.user_id)
      .eq("group_id", ctx.group.id)
      .gte("log_date", startOfIsoWeek(today))
      .lte("log_date", addDays(startOfIsoWeek(today), 6)),
  ]);
  const logsByHabit = new Map<string, Map<IsoDate, HabitLogStatus>>();
  for (const l of logsRes.data ?? []) {
    const m = logsByHabit.get(l.habit_id) ?? new Map<IsoDate, HabitLogStatus>();
    m.set(l.log_date, l.status);
    logsByHabit.set(l.habit_id, m);
  }
  const workouts = workoutsRes.data ?? [];

  const visible = ctx.members.filter((m) => m.shares || m.userId === claim.user_id);
  const ranked = ctx.group.comparison_enabled;
  let members = visible
    .filter((m) => !ranked || m.inComparison || m.userId === claim.user_id)
    .map((m) => {
      const s = ctx.series.get(m.userId) ?? [];
      return {
        name: m.name,
        isMe: m.userId === claim.user_id,
        weekPercent: summarize(s, weekStart, today).percent,
        streak: computeStreaks(s, threshold, today).current,
      };
    });
  members = ranked
    ? members.sort((a, b) => (b.weekPercent ?? -1) - (a.weekPercent ?? -1) || b.streak - a.streak)
    : members.sort((a, b) => a.name.localeCompare(b.name, "es"));

  const collective = visible.reduce(
    (acc, m) => {
      const t = summarize(ctx.series.get(m.userId) ?? [], weekStart, today);
      return { done: acc.done + t.completed, required: acc.required + t.required };
    },
    { done: 0, required: 0 },
  );

  return composeWeeklySummary({
    to: claim.email,
    name: claim.display_name,
    groupName: ctx.group.name,
    week: summarize(mySeries, weekStart, today),
    streak: computeStreaks(mySeries, threshold, today),
    workouts: { count: workouts.length, minutes: workouts.reduce((a, w) => a + w.duration_min, 0) },
    weeklyTargets: ctx.habits
      .filter((h) => h.frequency === "weekly_target")
      .map((h) => {
        const p = weeklyTargetProgress(logsByHabit.get(h.id) ?? new Map(), startOfIsoWeek(today), h.weekly_target ?? 1);
        return { name: h.name, done: p.done, target: p.target };
      }),
    members: members.slice(0, 50),
    collective,
    ranked,
    hiddenMembers: ctx.members.length - visible.length,
    siteUrl,
    unsubscribeUrl,
  });
}
