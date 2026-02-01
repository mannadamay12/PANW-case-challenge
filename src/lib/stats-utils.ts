import type { Template } from "../types/templates";

/**
 * Select featured templates using local date for daily rotation.
 * Prefers default templates, then shuffles based on the current date.
 */
export function selectFeaturedTemplates(
  templates: Template[],
  count: number = 2
): Template[] {
  if (templates.length === 0) return [];

  // Use local date (not UTC) for user-facing rotation
  const now = new Date();
  const localDateSeed =
    now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

  // Prefer default templates
  const defaults = templates.filter((t) => t.is_default);
  const custom = templates.filter((t) => !t.is_default);

  // Stable shuffle based on date + template ID
  const shuffled = [...defaults, ...custom].sort((a, b) => {
    const hashA = simpleHash(a.id + localDateSeed);
    const hashB = simpleHash(b.id + localDateSeed);
    return hashA - hashB;
  });

  return shuffled.slice(0, count);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Get a greeting based on the current time of day.
 */
export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
