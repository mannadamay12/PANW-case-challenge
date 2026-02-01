import { Lightbulb, CaretRight } from "@phosphor-icons/react";
import { Button } from "../ui/Button";

interface DailyPromptProps {
  onStartWriting: (prompt: string) => void;
}

// A collection of thoughtful journaling prompts
const PROMPTS = [
  "What small moment brought you joy today?",
  "What are you grateful for right now?",
  "Reflect on a small win from yesterday.",
  "What would make tomorrow a great day?",
  "What's something you learned recently?",
  "How are you feeling in this moment?",
  "What's a challenge you overcame this week?",
  "What are you looking forward to?",
  "What does your ideal day look like?",
  "What's something kind someone did for you recently?",
  "What would you tell your younger self?",
  "What's a goal you're working toward?",
  "What made you smile today?",
  "What's something you're proud of?",
  "What do you need to let go of?",
  "What brings you peace?",
  "What are you curious about?",
  "What's a recent win, big or small?",
  "How have you grown this year?",
  "What does self-care look like for you today?",
  "What's weighing on your heart?",
  "What inspires you?",
  "What boundaries do you need to set?",
  "What are you excited about?",
  "What do you wish others understood about you?",
  "What's a memory that makes you happy?",
  "What does success mean to you?",
  "What's something you want to remember about today?",
  "How can you be kinder to yourself?",
  "What are you hopeful about?",
];

function getDailyPrompt(): string {
  // Use the current date to select a prompt deterministically
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return PROMPTS[dayOfYear % PROMPTS.length];
}

export function DailyPrompt({ onStartWriting }: DailyPromptProps) {
  const prompt = getDailyPrompt();

  return (
    <div className="bg-gradient-to-br from-sanctuary-accent/5 to-sanctuary-accent/10 border border-sanctuary-accent/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-sanctuary-accent/20 flex items-center justify-center">
          <Lightbulb className="h-4 w-4 text-sanctuary-accent" />
        </div>
        <h3 className="text-sm font-medium text-sanctuary-text">Daily Prompt</h3>
      </div>

      <p className="text-sanctuary-text font-medium mb-4 leading-relaxed">
        "{prompt}"
      </p>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onStartWriting(prompt)}
        className="text-sanctuary-accent hover:text-sanctuary-accent hover:bg-sanctuary-accent/10"
      >
        Start Writing
        <CaretRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
