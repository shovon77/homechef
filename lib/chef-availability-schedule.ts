/** Shared day/time options for chef pickup and delivery scheduling. */

export type AvailabilitySlot = { day: string; timeWindow: string };

export const CHEF_DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const CHEF_TIME_WINDOWS = [
  '08:00 AM - 09:00 AM',
  '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 01:00 PM',
  '01:00 PM - 02:00 PM',
  '02:00 PM - 03:00 PM',
  '03:00 PM - 04:00 PM',
  '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM',
  '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM',
] as const;

export function groupSlotsByDay(slots: AvailabilitySlot[]): Record<string, string[]> {
  const byDay: Record<string, string[]> = {};
  for (const slot of slots) {
    if (!byDay[slot.day]) byDay[slot.day] = [];
    byDay[slot.day].push(slot.timeWindow);
  }
  return byDay;
}

export function formatGroupedSlots(slots: AvailabilitySlot[]): string {
  const byDay = groupSlotsByDay(slots);
  return Object.entries(byDay)
    .map(([day, windows]) => `${day}: ${windows.join(', ')}`)
    .join(' · ');
}
