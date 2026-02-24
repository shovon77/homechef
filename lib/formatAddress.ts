/**
 * Format location address for display: Street Address, City, Province (e.g. ON). No country.
 */
export function formatLocationAddress(
  location: string | null | undefined
): { street: string; city: string; province: string } {
  if (!location) {
    return { street: 'Not available', city: '', province: '' };
  }

  try {
    const parts = location.split(',').map((p) => p.trim());
    const street = parts[0] || 'Not available';
    let city = parts.length > 1 ? parts[1] : '';
    let province = '';

    const provinceRegex = /\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/i;
    const stateRegex =
      /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i;

    if (parts.length >= 2) {
      const cityPart = parts[1];
      city = cityPart.replace(/\s*[A-Z]\d[A-Z]\s?\d[A-Z]\d\s*/gi, '').trim();
      if (!city) city = cityPart;
    }

    if (parts.length >= 3) {
      const thirdPart = parts[2];
      const provMatch = thirdPart.match(provinceRegex) || thirdPart.match(stateRegex);
      province = provMatch ? provMatch[1].toUpperCase() : '';
    }
    if (!province && location) {
      const locMatch = location.match(provinceRegex) || location.match(stateRegex);
      province = locMatch ? locMatch[1].toUpperCase() : '';
    }

    return { street, city, province };
  } catch {
    return { street: location, city: '', province: '' };
  }
}

/** One-line display format: Street Address, City, Province (no country) */
export function formatLocationDisplay(location: string | null | undefined): string {
  const { street, city, province } = formatLocationAddress(location);
  return [street, city, province].filter(Boolean).join(', ');
}
