import {
  Apple,
  Bed,
  Bike,
  BookOpen,
  Brain,
  Check,
  Code,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  GraduationCap,
  Heart,
  Languages,
  Leaf,
  Moon,
  Mountain,
  Music,
  NotebookPen,
  PenLine,
  PersonStanding,
  Rocket,
  Smile,
  Snowflake,
  Sparkles,
  Sun,
  Swords,
  Target,
  Timer,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Lista cerrada de iconos permitidos (la BD sólo acepta [a-z0-9-]). */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  check: Check,
  dumbbell: Dumbbell,
  swords: Swords,
  "person-standing": PersonStanding,
  zap: Zap,
  "notebook-pen": NotebookPen,
  "book-open": BookOpen,
  sun: Sun,
  "graduation-cap": GraduationCap,
  rocket: Rocket,
  heart: Heart,
  brain: Brain,
  droplet: Droplet,
  moon: Moon,
  bed: Bed,
  apple: Apple,
  bike: Bike,
  footprints: Footprints,
  timer: Timer,
  target: Target,
  flame: Flame,
  music: Music,
  code: Code,
  "pen-line": PenLine,
  languages: Languages,
  leaf: Leaf,
  mountain: Mountain,
  snowflake: Snowflake,
  sparkles: Sparkles,
  smile: Smile,
};

export function HabitIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = HABIT_ICONS[name] ?? Check;
  return <Icon className={className} aria-hidden="true" />;
}
