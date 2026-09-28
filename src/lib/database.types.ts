/**
 * Tipos del esquema `public` (espejo de supabase/migrations).
 * Si cambias el esquema puedes regenerarlos con:
 *   npx supabase gen types typescript --local > src/lib/database.types.ts
 */

export type GroupRole = "admin" | "member";
export type HabitCategory = "physical" | "mental" | "productivity" | "health" | "other";
export type HabitFrequency = "daily" | "weekdays" | "weekly_target";
export type HabitLogStatus = "done" | "missed" | "skipped";
export type WorkoutType = "gym" | "boxing" | "cardio" | "mobility" | "other";

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string | null;
  avatar_color: string;
  timezone: string;
} & Timestamps;

export type UserSettingsRow = {
  user_id: string;
  share_habits: boolean;
  share_workouts: boolean;
  show_in_comparison: boolean;
  reminder_enabled: boolean;
  reminder_time: string;
  active_group_id: string | null;
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
  created_by: string | null;
  archived_at: string | null;
} & Timestamps;

export type HabitLogRow = {
  id: string;
  user_id: string;
  habit_id: string;
  group_id: string;
  log_date: string;
  status: HabitLogStatus;
} & Timestamps;

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
      daily_entries: Table<DailyEntryRow>;
      workouts: Table<WorkoutRow>;
      achievements: Table<AchievementRow>;
      user_achievements: Table<UserAchievementRow>;
    };
    Views: Record<string, never>;
    Functions: {
      username_available: { Args: { p_username: string }; Returns: boolean };
      create_invitation: {
        Args: { p_group_id: string; p_expires_in_hours?: number | null; p_max_uses?: number | null };
        Returns: GroupInvitationRow;
      };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
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
      join_group: { Args: { p_code: string }; Returns: { status: string; group_id: string | null }[] };
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
      remove_member: { Args: { p_group_id: string; p_user_id: string }; Returns: undefined };
      set_member_role: { Args: { p_group_id: string; p_user_id: string; p_role: GroupRole }; Returns: undefined };
      transfer_admin: { Args: { p_group_id: string; p_user_id: string }; Returns: undefined };
      delete_group: { Args: { p_group_id: string }; Returns: undefined };
      set_habit_status: {
        Args: { p_habit_id: string; p_date: string; p_status: HabitLogStatus | null };
        Returns: HabitLogRow | null;
      };
      daily_stats: {
        Args: { p_group_id: string; p_from: string; p_to: string; p_user_id?: string | null };
        Returns: DailyStatRow[];
      };
      group_workout_summary: {
        Args: { p_group_id: string; p_from: string; p_to: string };
        Returns: { user_id: string; workouts: number; minutes: number }[];
      };
      group_member_visibility: {
        Args: { p_group_id: string };
        Returns: { user_id: string; share_habits: boolean; share_workouts: boolean; show_in_comparison: boolean }[];
      };
      evaluate_my_achievements: { Args: Record<string, never>; Returns: string[] };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
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
