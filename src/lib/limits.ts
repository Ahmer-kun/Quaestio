/**
 * Anti-abuse posting limits. These values must match the database trigger
 * in supabase/migrations/20261014120000_activity_limits.sql.
 */
export const POSTING_LIMITS = {
  postsPerHour: 3,
  postsPerDay: 5,
  commentsPerHour: 15,
  commentsPerDay: 60,
} as const;

/**
 * Formats seconds into a friendly human-readable wait string.
 * Under 60 seconds: "less than a minute"
 * Under 90 minutes: "about N minutes" (rounded up)
 * Otherwise: "about N hours" (rounded up)
 */
export function friendlyWaitSeconds(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return "less than a minute";
  const minutes = Math.ceil(s / 60);
  if (minutes < 90) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}
