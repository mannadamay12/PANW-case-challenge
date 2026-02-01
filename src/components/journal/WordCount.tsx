import { cn } from "../../lib/utils";

interface WordCountProps {
  content: string;
  className?: string;
}

export function WordCount({ content, className }: WordCountProps) {
  const words = content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const chars = content.length;
  const readingTime = Math.ceil(words / 200);

  const parts: string[] = [
    `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`,
    `${chars.toLocaleString()} chars`,
  ];

  if (words >= 50) {
    parts.push(`${readingTime} min read`);
  }

  return (
    <span className={cn("text-xs text-sanctuary-muted", className)}>
      {parts.join(" · ")}
    </span>
  );
}
