import type { EmotionPrediction } from "../../types/emotions";
import type { IconProps } from "@phosphor-icons/react";
import {
  Lightbulb,
  ArrowsOut,
  ArrowClockwise,
  Heart,
  HandHeart,
  Compass,
  Sparkle,
  PencilSimple,
  SunHorizon,
  Users,
  Mountains,
  FlowerLotus,
  Brain,
  Target,
  Binoculars,
  Lifebuoy,
  Scales,
  PuzzlePiece,
} from "@phosphor-icons/react";

export interface QuickAction {
  label: string;
  prompt: string;
  icon: React.ForwardRefExoticComponent<IconProps>;
}

const EMOTION_CATEGORIES = {
  grief: ["sadness", "grief", "disappointment", "remorse"],
  anxiety: ["fear", "nervousness", "confusion"],
  anger: ["anger", "annoyance", "disapproval", "disgust"],
  joy: ["joy", "excitement", "amusement", "optimism"],
  love: ["love", "gratitude", "admiration", "caring", "desire"],
  growth: ["curiosity", "surprise", "realization"],
  neutral: ["neutral", "approval", "relief"],
} as const;

function categorizeEmotion(label: string): keyof typeof EMOTION_CATEGORIES | null {
  for (const [category, emotions] of Object.entries(EMOTION_CATEGORIES)) {
    if ((emotions as readonly string[]).includes(label.toLowerCase())) {
      return category as keyof typeof EMOTION_CATEGORIES;
    }
  }
  return null;
}

const ACTIONS_BY_CATEGORY: Record<keyof typeof EMOTION_CATEGORIES, QuickAction[]> = {
  grief: [
    {
      label: "Validate",
      prompt: "Help me understand and accept why I feel this way without trying to fix it.",
      icon: Heart,
    },
    {
      label: "Ground",
      prompt: "Help me stay present with this feeling. What sensations am I noticing?",
      icon: FlowerLotus,
    },
    {
      label: "Comfort",
      prompt: "What would I tell a friend who was feeling exactly this way?",
      icon: HandHeart,
    },
  ],
  anxiety: [
    {
      label: "Untangle",
      prompt: "Help me separate what I can control from what I cannot in this situation.",
      icon: PuzzlePiece,
    },
    {
      label: "Ground",
      prompt: "Guide me through grounding in the present moment. What's true right now?",
      icon: Mountains,
    },
    {
      label: "Plan",
      prompt: "What's one small, concrete step I could take to address this worry?",
      icon: Target,
    },
  ],
  anger: [
    {
      label: "Explore",
      prompt: "What unmet need or boundary might be underneath this feeling?",
      icon: Binoculars,
    },
    {
      label: "Validate",
      prompt: "Help me understand what feels unfair or violated in this situation.",
      icon: Scales,
    },
    {
      label: "Channel",
      prompt: "How can I express this energy in a way that serves me?",
      icon: Lifebuoy,
    },
  ],
  joy: [
    {
      label: "Capture",
      prompt: "Help me remember what made this moment special. What details should I preserve?",
      icon: Sparkle,
    },
    {
      label: "Gratitude",
      prompt: "What else am I grateful for right now? Help me expand this feeling.",
      icon: SunHorizon,
    },
    {
      label: "Share",
      prompt: "How could I share this feeling with someone I care about?",
      icon: Users,
    },
  ],
  love: [
    {
      label: "Deepen",
      prompt: "What does this feeling reveal about what matters most to me?",
      icon: Heart,
    },
    {
      label: "Express",
      prompt: "How could I express this appreciation or connection?",
      icon: PencilSimple,
    },
    {
      label: "Cultivate",
      prompt: "How can I create more moments that feel like this?",
      icon: FlowerLotus,
    },
  ],
  growth: [
    {
      label: "Explore",
      prompt: "What new possibility or understanding is emerging here?",
      icon: Compass,
    },
    {
      label: "Connect",
      prompt: "How does this connect to other things I've been thinking about?",
      icon: Brain,
    },
    {
      label: "Apply",
      prompt: "What action could I take based on this insight?",
      icon: Target,
    },
  ],
  neutral: [
    {
      label: "Reflect",
      prompt: "What emotions do you notice in this entry?",
      icon: Lightbulb,
    },
    {
      label: "Expand",
      prompt: "Help me expand on these thoughts and explore them deeper.",
      icon: ArrowsOut,
    },
    {
      label: "Reframe",
      prompt: "How might I see this situation from a different perspective?",
      icon: ArrowClockwise,
    },
  ],
};

const DEFAULT_ACTIONS: QuickAction[] = ACTIONS_BY_CATEGORY.neutral;

/**
 * Returns emotion-aware quick actions based on detected emotions.
 * If no emotions detected or no dominant category, returns default actions.
 */
export function getSmartActions(emotions: EmotionPrediction[] | undefined): QuickAction[] {
  if (!emotions || emotions.length === 0) {
    return DEFAULT_ACTIONS;
  }

  const dominant = emotions[0];
  if (dominant.score < 0.3) {
    // Low confidence, use defaults
    return DEFAULT_ACTIONS;
  }

  const category = categorizeEmotion(dominant.label);
  if (!category) {
    return DEFAULT_ACTIONS;
  }

  return ACTIONS_BY_CATEGORY[category];
}

/**
 * Returns the dominant emotion category name for display purposes.
 */
export function getDominantCategory(emotions: EmotionPrediction[] | undefined): string | null {
  if (!emotions || emotions.length === 0 || emotions[0].score < 0.3) {
    return null;
  }
  return categorizeEmotion(emotions[0].label);
}
