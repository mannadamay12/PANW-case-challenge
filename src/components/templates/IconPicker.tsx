import {
  Heart,
  Sun,
  Moon,
  Star,
  Trophy,
  CheckCircle,
  Lightbulb,
  ThumbsUp,
  Target,
  Clock,
  Users,
  BookOpen,
  Bookmark,
  Pencil,
  Puzzle,
  Leaf,
  Plane,
  Pin,
  Dumbbell,
  Home,
  Bed,
  Utensils,
  Coffee,
  Cake,
  Tv,
  Film,
  Music,
  Camera,
  Smile,
  Frown,
  Meh,
  Zap,
  Flame,
  Cloud,
  Droplet,
  Wind,
  Accessibility,
  Brain,
  Eye,
  Hand,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const ICON_MAP: Record<string, LucideIcon> = {
  heart: Heart,
  sun: Sun,
  moon: Moon,
  star: Star,
  trophy: Trophy,
  "check-circle": CheckCircle,
  lightbulb: Lightbulb,
  "thumbs-up": ThumbsUp,
  target: Target,
  clock: Clock,
  users: Users,
  "book-open": BookOpen,
  bookmark: Bookmark,
  pencil: Pencil,
  puzzle: Puzzle,
  leaf: Leaf,
  plane: Plane,
  pin: Pin,
  dumbbell: Dumbbell,
  home: Home,
  bed: Bed,
  utensils: Utensils,
  coffee: Coffee,
  cake: Cake,
  tv: Tv,
  film: Film,
  music: Music,
  camera: Camera,
  smile: Smile,
  frown: Frown,
  meh: Meh,
  zap: Zap,
  flame: Flame,
  cloud: Cloud,
  droplet: Droplet,
  wind: Wind,
  accessibility: Accessibility,
  brain: Brain,
  eye: Eye,
  hand: Hand,
};

export const ICON_OPTIONS = Object.keys(ICON_MAP);

interface IconPickerProps {
  value: string | null;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ICON_OPTIONS.map((iconName) => {
        const Icon = ICON_MAP[iconName];
        const isSelected = value === iconName;

        return (
          <button
            key={iconName}
            type="button"
            onClick={() => onChange(iconName)}
            className={cn(
              "p-2 rounded-lg transition-all flex items-center justify-center",
              isSelected
                ? "bg-sanctuary-accent text-white ring-2 ring-sanctuary-accent ring-offset-2"
                : "bg-stone-100 text-sanctuary-muted hover:bg-stone-200 hover:text-sanctuary-text"
            )}
            title={iconName}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}

interface TemplateIconProps {
  icon: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TemplateIcon({ icon, size = "md", className }: TemplateIconProps) {
  const Icon = icon ? ICON_MAP[icon] : BookOpen;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return <Icon className={cn(sizeClasses[size], className)} />;
}
