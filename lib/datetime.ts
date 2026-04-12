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

// ============================================================================
// Chef pickup availability helpers
// ============================================================================

type PickupSlot = { day: string; timeWindow: string };

/**
 * Parses a timeWindow string from either format into start/end hours.
 * Handles: "08:00-09:00" (24h from onboarding) and "08:00 AM - 09:00 AM" (12h from profile editor).
 */
export function parseTimeWindow(tw: string): { startHour: number; endHour: number } | null {
  // Format 1: "HH:MM-HH:MM" (24h, no spaces around dash)
  const fmt24 = tw.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (fmt24 && !tw.includes('AM') && !tw.includes('PM')) {
    return { startHour: parseInt(fmt24[1], 10), endHour: parseInt(fmt24[3], 10) };
  }

  // Format 2: "HH:MM AM - HH:MM PM" (12h with AM/PM labels)
  const fmt12 = tw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (fmt12) {
    const to24 = (h: number, ampm: string) => {
      const upper = ampm.toUpperCase();
      if (upper === 'AM' && h === 12) return 0;
      if (upper === 'PM' && h !== 12) return h + 12;
      return h;
    };
    return {
      startHour: to24(parseInt(fmt12[1], 10), fmt12[3]),
      endHour: to24(parseInt(fmt12[4], 10), fmt12[6]),
    };
  }

  return null;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Given chef pickup_availability, returns the next calendar dates (up to `maxDates`)
 * whose weekday matches one of the chef's available days.
 * Scans up to `scanDays` days forward starting from tomorrow.
 */
export function getAvailableDatesForChef(
  slots: PickupSlot[],
  maxDates = 7,
  scanDays = 14,
): Date[] {
  const availableDayNames = new Set(slots.map(s => s.day));
  const results: Date[] = [];
  const today = new Date();

  for (let offset = 1; offset <= scanDays && results.length < maxDates; offset++) {
    const d = new Date();
    d.setDate(today.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    if (availableDayNames.has(WEEKDAY_NAMES[d.getDay()])) {
      results.push(d);
    }
  }
  return results;
}

/**
 * Given chef pickup_availability and a selected date, returns the hourly time slots
 * that fall within the chef's configured windows for that weekday.
 * Each window like "08:00-09:00" yields a single slot at 8:00 AM (the start hour).
 */
export function getTimeSlotsForDate(
  slots: PickupSlot[],
  selectedDate: Date,
): Array<{ value: string; label: string }> {
  const dayName = WEEKDAY_NAMES[selectedDate.getDay()];
  const daySlots = slots.filter(s => s.day === dayName);

  const hours = new Set<number>();
  for (const slot of daySlots) {
    const parsed = parseTimeWindow(slot.timeWindow);
    if (!parsed) continue;
    hours.add(parsed.startHour);
  }

  const sortedHours = Array.from(hours).sort((a, b) => a - b);

  return sortedHours.map(hour => {
    const hour24 = hour.toString().padStart(2, '0');
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return { value: `${hour24}:00`, label: `${hour12}:00 ${ampm}` };
  });
}
