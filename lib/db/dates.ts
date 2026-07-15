// CANONICAL: UTC date helpers for FamComply timelines, reminders, and emails.
// Requirement dates are calendar dates (YYYY-MM-DD), so all math happens at UTC midnight.

const MILLISECONDS_PER_DAY = 86_400_000;

export function todayUtcIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysToTodayUtc(days: number): string {
  const date = new Date(`${todayUtcIsoDate()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysFromTodayUtc(targetIsoDate: string): number {
  const todayMs = Date.parse(`${todayUtcIsoDate()}T00:00:00Z`);
  const targetMs = Date.parse(`${targetIsoDate}T00:00:00Z`);
  return Math.round((targetMs - todayMs) / MILLISECONDS_PER_DAY);
}

export function formatDateUtc(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Rejects impossible dates like 2026-02-30, which JavaScript would silently roll forward.
export function isValidCalendarDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return false;
  }
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === isoDate;
}
