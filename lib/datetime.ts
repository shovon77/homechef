export const PICKUP_START_HOUR = 8;
export const PICKUP_END_HOUR = 20; // inclusive 20:00
export const PICKUP_MAX_DAYS = 7;

export function formatLocal(dtISO?: string | null, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  if (!dtISO) return '—';
  const d = new Date(dtISO);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, options);
}

const EST_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

export function formatEst(dtISO?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!dtISO) return '—';
  const d = new Date(dtISO);
  if (Number.isNaN(d.getTime())) return '—';
  const opts = options ? { ...EST_OPTIONS, ...options } : EST_OPTIONS;
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d);
  const day = parts.find(p => p.type === 'weekday')?.value ?? '';
  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const dayNum = parts.find(p => p.type === 'day')?.value ?? '';
  const hour = parts.find(p => p.type === 'hour')?.value ?? '';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '';
  const ampm = parts.find(p => p.type === 'dayPeriod')?.value ?? '';
  const datePart = `${day} ${month} ${dayNum}`;
  const timePart = `${hour}:${minute} ${ampm}`;
  return `${datePart}\n${timePart}`;
}

export function combineLocalDateTime(dateInput: string, timeInput: string): Date | null {
  const dateParts = dateInput.split('-').map(Number);
  const timeParts = timeInput.split(':').map(Number);
  if (dateParts.length !== 3 || timeParts.length < 2) return null;
  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  if (![year, month, day, hour, minute].every(n => Number.isFinite(n))) return null;
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function isValidPickup(dtLocal: Date): boolean {
  const now = new Date();
  const max = new Date();
  max.setDate(now.getDate() + PICKUP_MAX_DAYS);

  const hour = dtLocal.getHours();
  const minute = dtLocal.getMinutes();

  const withinHours =
    hour > PICKUP_START_HOUR && hour < PICKUP_END_HOUR ||
    (hour === PICKUP_START_HOUR && minute >= 0) ||
    (hour === PICKUP_END_HOUR && minute === 0);

  return dtLocal.getTime() >= now.getTime() && dtLocal.getTime() <= max.getTime() && withinHours;
}

export function toUtcISOString(dtLocal: Date): string {
  return new Date(dtLocal.getTime() - dtLocal.getTimezoneOffset() * 60000).toISOString();
}
