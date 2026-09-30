/**
 * Tipos del esquema `public` (espejo de supabase/migrations).
 * Si cambias el esquema puedes regenerarlos con:
 *   npx supabase gen types typescript --local > src/lib/database.types.ts
 */

export type GroupRole = "admin" | "member";
export type HabitCategory =
  "physical" | "mental" | "productivity" | "health" | "other";
export type HabitFrequency = "daily" | "weekdays" | "weekly_target";
export type HabitLogStatus = "done" | "missed" | "skipped";
export type WorkoutType = "gym" | "boxing" | "cardio" | "mobility" | "other";
export type NotificationKind = "daily_reminder" | "weekly_summary";

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string | null;
  avatar_color: string;
  timezone: string;
  can_create_groups: boolean;
} & Timestamps;

export type UserSettingsRow = {
  user_id: string;
  share_habits: boolean;
  share_workouts: boolean;
  show_in_comparison: boolean;
  reminder_enabled: boolean;
  reminder_time: string;
  active_group_id: string | null;
  email_daily_reminder: boolean;
  email_weekly_summary: boolean;
  notification_email: string | null;
  notification_email_verified_at: string | null;
  unsubscribe_token: string;
} & Timestamps;

export type GroupRow = {
  id: string;
  name: string;
  description: string;
  rules: string;
  start_date: string;
  end_date: string;
  streak_threshold: number;
  comparison_enabled: boolean;
  max_members: number;
  requires_pro: boolean;
  created_by: string | null;
  deleted_at: string | null;
} & Timestamps;

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
};

export type GroupInvitationRow = {
  id: string;
  group_id: string;
  code: string;
  created_by: string | null;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
};

export type HabitRow = {
  id: string;
  group_id: string;
  name: string;
  description: string;
  icon: string;
  category: HabitCategory;
  color: string;
  frequency: HabitFrequency;
  weekdays: number[];
  weekly_target: number | null;
  is_optional: boolean;
  goal: string;
  sort_order: number;
  is_active: boolean;
  starts_on: string;
  weight: number;
  created_by: string | null;
  archived_at: string | null;
} & Timestamps;

export type HabitRevisionRow = {
  habit_id: string;
  group_id: string;
  effective_from: string;
  weight: number;
  category: HabitCategory;
  frequency: HabitFrequency;
  weekdays: number[];
  weekly_target: number | null;
  is_optional: boolean;
  is_active: boolean;
  archived: boolean;
  starts_on: string;
  recorded_at: string;
};

export type RankSnapshotRow = {
  user_id: string;
  group_id: string;
  snapshot_date: string;
  daily_score: number | null;
  discipline_score: number;
  tier_index: number;
  phase: "provisional" | "estimated" | "stabilizing" | "stable";
  current_streak: number;
  best_streak: number;
  consistency: number | null;
  category_scores: Record<string, { score: number; tier_index: number }>;
  components: Record<string, number>;
  inputs: {
    required: number;
    done: number;
    weights: Record<string, number>;
    completed: string[];
  };
  algorithm_version: number;
  computed_at: string;
};

export type HabitLogRow = {
  id: string;
  user_id: string;
  habit_id: string;
  group_id: string;
  log_date: string;
  status: HabitLogStatus;
} & Timestamps;

export type ActivityKind =
  "day_complete" | "achievement" | "rank_up" | "duel_accepted" | "joined";
export type ReactionEmoji = "🔥" | "💪" | "👏" | "🫡";

export type GroupActivityRow = {
  id: number;
  group_id: string;
  user_id: string;
  kind: ActivityKind;
  event_key: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ActivityReactionRow = {
  activity_id: number;
  user_id: string;
  group_id: string;
  emoji: ReactionEmoji;
  created_at: string;
};

export type DuelStatus = "pending" | "accepted" | "declined" | "cancelled";

export type DuelRow = {
  id: string;
  group_id: string;
  challenger_id: string;
  opponent_id: string;
  week_start: string;
  status: DuelStatus;
  created_at: string;
  responded_at: string | null;
};

export type SubscriptionRow = {
  user_id: string;
  provider: "stripe" | "paypal";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  paypal_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
};

export type TrainingProfileRow = {
  user_id: string;
  birth_year: number;
  sex: "male" | "female";
  height_cm: number;
  weight_kg: number;
  goal: "fat_loss" | "recomp" | "muscle" | "strength" | "endurance" | "health";
  level: "beginner" | "intermediate" | "advanced";
  training_type: "gym" | "home_dumbbells" | "bodyweight" | "running" | "mixed";
  days_per_week: number;
  session_minutes: number;
  limitations: (
    "knee" | "lower_back" | "shoulder" | "wrist" | "hip" | "ankle"
  )[];
  focus:
    | "balanced"
    | "glutes_legs"
    | "chest_arms"
    | "back_posture"
    | "shoulders"
    | "core";
  preferred_days: number[];
  updated_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  created_at: string;
};

export type DailyEntryRow = {
  user_id: string;
  entry_date: string;
  did_today: string;
  improve_tomorrow: string;
} & Timestamps;

export type WorkoutRow = {
  id: string;
  user_id: string;
  workout_date: string;
  type: WorkoutType;
  duration_min: number;
  intensity: number | null;
  feeling: number | null;
  exercises: string;
  notes: string;
  next_goal: string;
} & Timestamps;

export type AchievementRow = {
  code: string;
  name: string;
  description: string;
  emoji: string;
  metric: string;
  threshold: number;
  xp: number;
  sort_order: number;
};

export type UserAchievementRow = {
  user_id: string;
  achievement_code: string;
  unlocked_at: string;
};

export type DailyStatRow = {
  user_id: string;
  day: string;
  required: number;
  completed: number;
  skipped: number;
  bonus: number;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      user_settings: Table<UserSettingsRow>;
      groups: Table<GroupRow>;
      group_members: Table<GroupMemberRow>;
      group_invitations: Table<GroupInvitationRow>;
      habits: Table<HabitRow>;
      habit_logs: Table<HabitLogRow>;
      habit_revisions: Table<HabitRevisionRow>;
      rank_snapshots: Table<RankSnapshotRow>;
      group_activity: Table<GroupActivityRow>;
      activity_reactions: Table<ActivityReactionRow>;
      duels: Table<DuelRow>;
      subscriptions: Table<SubscriptionRow>;
      training_profiles: Table<TrainingProfileRow>;
      push_subscriptions: Table<PushSubscriptionRow>;
      daily_entries: Table<DailyEntryRow>;
      workouts: Table<WorkoutRow>;
      achievements: Table<AchievementRow>;
      user_achievements: Table<UserAchievementRow>;
    };
    Views: Record<string, never>;
    Functions: {
      username_available: { Args: { p_username: string }; Returns: boolean };
      create_invitation: {
        Args: {
          p_group_id: string;
          p_expires_in_hours?: number | null;
          p_max_uses?: number | null;
        };
        Returns: GroupInvitationRow;
      };
      revoke_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      get_invitation_preview: {
        Args: { p_code: string };
        Returns: {
          status: string;
          group_name: string | null;
          group_description: string | null;
          member_count: number | null;
          already_member: boolean;
        }[];
      };
      join_group: {
        Args: { p_code: string };
        Returns: { status: string; group_id: string | null }[];
      };
      create_group: {
        Args: {
          p_name: string;
          p_description?: string;
          p_start_date?: string | null;
          p_end_date?: string | null;
          p_seed_defaults?: boolean;
        };
        Returns: string;
      };
      leave_group: { Args: { p_group_id: string }; Returns: undefined };
      remove_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: undefined;
      };
      set_member_role: {
        Args: { p_group_id: string; p_user_id: string; p_role: GroupRole };
        Returns: undefined;
      };
      transfer_admin: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: undefined;
      };
      delete_group: { Args: { p_group_id: string }; Returns: undefined };
      set_habit_status: {
        Args: {
          p_habit_id: string;
          p_date: string;
          p_status: HabitLogStatus | null;
        };
        Returns: HabitLogRow | null;
      };
      daily_stats: {
        Args: {
          p_group_id: string;
          p_from: string;
          p_to: string;
          p_user_id?: string | null;
        };
        Returns: DailyStatRow[];
      };
      group_workout_summary: {
        Args: { p_group_id: string; p_from: string; p_to: string };
        Returns: { user_id: string; workouts: number; minutes: number }[];
      };
      group_member_visibility: {
        Args: { p_group_id: string };
        Returns: {
          user_id: string;
          share_habits: boolean;
          share_workouts: boolean;
          show_in_comparison: boolean;
        }[];
      };
      has_full_access: { Args: { p_group_id: string }; Returns: boolean };
      group_pro_status: {
        Args: { p_group_id: string };
        Returns: {
          user_id: string;
          pro_until: string | null;
          active: boolean;
          trial_until: string | null;
        }[];
      };
      my_pro_trial_end: { Args: Record<string, never>; Returns: string | null };
      group_pro_members: { Args: { p_group_id: string }; Returns: string[] };
      claim_push_batch: {
        Args: { p_now?: string; p_limit?: number };
        Returns: {
          user_id: string;
          display_name: string;
          group_id: string;
          local_date: string;
          period_key: string;
        }[];
      };
      billing_config_set_if_absent: {
        Args: { p_key: string; p_value: string };
        Returns: string | null;
      };
      staff_metrics: {
        Args: Record<string, never>;
        Returns: {
          users: number;
          active_today: number;
          active_7d: number;
          on_trial: number;
          trials_ending_7d: number;
          paid: number;
          lifetime: number;
          free_only: number;
          push_devices: number;
          referrals: number;
        }[];
      };
      my_referral_status: {
        Args: Record<string, never>;
        Returns: { referrals: number; bonus_until: string | null }[];
      };
      my_pro_lifetime: { Args: Record<string, never>; Returns: boolean };
      am_i_staff: { Args: Record<string, never>; Returns: boolean };
      staff_pro_list: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          display_name: string;
          username: string;
          avatar_emoji: string | null;
          avatar_color: string;
          pro_until: string | null;
          trial_until: string | null;
          active: boolean;
          lifetime: boolean;
        }[];
      };
      staff_grant_pro: {
        Args: { p_user_id: string; p_months: number };
        Returns: string | null;
      };
      grant_manual_pro: {
        Args: { p_group_id: string; p_user_id: string; p_months: number };
        Returns: string | null;
      };
      billing_config_get: { Args: { p_key: string }; Returns: string | null };
      billing_config_set: {
        Args: { p_key: string; p_value: string };
        Returns: undefined;
      };
      create_duel: {
        Args: {
          p_group_id: string;
          p_opponent_id: string;
          p_week_start: string;
        };
        Returns: string;
      };
      respond_duel: {
        Args: { p_duel_id: string; p_accept: boolean };
        Returns: undefined;
      };
      cancel_duel: { Args: { p_duel_id: string }; Returns: undefined };
      evaluate_my_achievements: {
        Args: Record<string, never>;
        Returns: string[];
      };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      invite_signup_preview: {
        Args: { p_code: string };
        Returns: { status: string; group_name: string | null }[];
      };
      admin_allow_signup: { Args: { p_email: string }; Returns: undefined };
      my_notification_email: {
        Args: Record<string, never>;
        Returns: {
          account_email: string;
          account_confirmed: boolean;
          notification_email: string | null;
          verified: boolean;
          pending_email: string | null;
        }[];
      };
      use_account_email_for_notifications: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      admin_create_email_verification: {
        Args: { p_user_id: string; p_email: string; p_token_hash: string };
        Returns: undefined;
      };
      verify_notification_email: {
        Args: { p_token: string };
        Returns: boolean;
      };
      unsubscribe_emails: { Args: { p_token: string }; Returns: boolean };
      claim_notification_batch: {
        Args: { p_kind: NotificationKind; p_now?: string; p_limit?: number };
        Returns: {
          user_id: string;
          email: string;
          display_name: string;
          timezone: string;
          group_id: string;
          local_date: string;
          period_key: string;
          unsubscribe_token: string;
        }[];
      };
      finish_notification: {
        Args: {
          p_user_id: string;
          p_kind: NotificationKind | "push_reminder";
          p_period_key: string;
          p_status: "sent" | "skipped" | "failed";
        };
        Returns: undefined;
      };
    };
    Enums: {
      group_role: GroupRole;
      habit_category: HabitCategory;
      habit_frequency: HabitFrequency;
      habit_log_status: HabitLogStatus;
      workout_type: WorkoutType;
    };
    CompositeTypes: Record<string, never>;
  };
};
