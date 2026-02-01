interface WordCountProps {
  content: string;
  className?: string;
}

export function WordCount({ content, className = "" }: WordCountProps) {
  const count = content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <span className={`text-xs text-sanctuary-muted ${className}`}>
      {count} {count === 1 ? "word" : "words"}
    </span>
  );
}
