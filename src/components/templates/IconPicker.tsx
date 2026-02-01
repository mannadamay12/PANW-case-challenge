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
  BookOpenText,
  BookmarkSimple,
  Pencil,
  PuzzlePiece,
  Leaf,
  Airplane,
  MapPin,
  Barbell,
  House,
  Bed,
  ForkKnife,
  Coffee,
  Cake,
  Television,
  FilmStrip,
  MusicNotes,
  Camera,
  Smiley,
  SmileyMeh,
  SmileySad,
  Lightning,
  Flame,
  Cloud,
  Drop,
  Wind,
  Wheelchair,
  Brain,
  Eye,
  HandWaving,
  Envelope,
  Hand,
  Person,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

export const ICON_MAP: Record<string, Icon> = {
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
  "book-open": BookOpenText,
  bookmark: BookmarkSimple,
  pencil: Pencil,
  puzzle: PuzzlePiece,
  leaf: Leaf,
  plane: Airplane,
  pin: MapPin,
  dumbbell: Barbell,
  home: House,
  bed: Bed,
  utensils: ForkKnife,
  coffee: Coffee,
  cake: Cake,
  tv: Television,
  film: FilmStrip,
  music: MusicNotes,
  camera: Camera,
  smile: Smiley,
  frown: SmileySad,
  meh: SmileyMeh,
  zap: Lightning,
  flame: Flame,
  cloud: Cloud,
  droplet: Drop,
  wind: Wind,
  accessibility: Wheelchair,
  brain: Brain,
  eye: Eye,
  hand: HandWaving,
  envelope: Envelope,
  palm: Hand,
  person: Person,
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
                ? "bg-sanctuary-accent text-white ring-2 ring-sanctuary-accent ring-offset-2 dark:ring-offset-sanctuary-card"
                : "bg-sanctuary-hover text-sanctuary-muted hover:bg-sanctuary-selected hover:text-sanctuary-text"
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
  const Icon = icon ? ICON_MAP[icon] : BookOpenText;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-7 w-7",
  };

  return <Icon className={cn(sizeClasses[size], className)} />;
}
