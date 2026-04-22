import { Alert, Platform } from 'react-native';

export function getPickupWindow(pickupAt: string | null): { start: Date; end: Date } | null {
  if (!pickupAt) return null;
  const start = new Date(pickupAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { start, end };
}

function icsDateUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function buildPickupIcs(params: {
  start: Date;
  end: Date;
  title: string;
  description: string;
  location: string;
}): string {
  const uid = `homechef-pickup-${params.start.getTime()}@homechef`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HomeChef//Pickup//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDateUtc(new Date())}`,
    `DTSTART:${icsDateUtc(params.start)}`,
    `DTEND:${icsDateUtc(params.end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
    `DESCRIPTION:${escapeIcsText(params.description)}`,
    `LOCATION:${escapeIcsText(params.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcsOnWeb(ics: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Opens system “new event” UI on iOS/Android, or downloads an .ics on web. */
export async function addPickupToUserCalendar(params: {
  pickupAt: string | null;
  orderId: number;
  locationDescription: string;
}): Promise<void> {
  const win = getPickupWindow(params.pickupAt);
  if (!win) {
    Alert.alert('Pickup time unavailable', 'There is no scheduled pickup time to add to your calendar.');
    return;
  }

  const { start, end } = win;
  const orderLabel = String(params.orderId).padStart(5, '0');
  const title = `HomeChef pickup — Order #${orderLabel}`;
  const notes = 'Pickup window for your HomeChef order (1 hour). Open the app for order details.';
  const location = params.locationDescription.trim();

  if (Platform.OS === 'web') {
    const ics = buildPickupIcs({
      start,
      end,
      title,
      description: notes,
      location,
    });
    downloadIcsOnWeb(ics, `homechef-pickup-order-${params.orderId}.ics`);
    return;
  }

  try {
    const Calendar = await import('expo-calendar');
    const available = await Calendar.isAvailableAsync();
    if (!available) {
      Alert.alert('Calendar unavailable', 'Calendar is not available on this device.');
      return;
    }
    await Calendar.createEventInCalendarAsync({
      title,
      startDate: start,
      endDate: end,
      location: location || undefined,
      notes,
    });
  } catch (e) {
    console.error(e);
    Alert.alert('Calendar', 'Could not open the calendar. Please try again.');
  }
}
