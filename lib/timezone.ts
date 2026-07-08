// lib/timezone.ts

// Country calling code -> IANA timezone, for countries that are effectively one timezone.
// Not exhaustive — covers common cases. Multi-timezone countries (US, Canada, Australia, Russia)
// are handled separately or default to a reasonable primary zone.
const COUNTRY_CODE_TIMEZONES: Record<string, string> = {
  "92": "Asia/Karachi",       // Pakistan
  "91": "Asia/Kolkata",       // India
  "44": "Europe/London",      // UK
  "971": "Asia/Dubai",        // UAE
  "966": "Asia/Riyadh",       // Saudi Arabia
  "61": "Australia/Sydney",   // Australia (primary zone; not accurate for WA/etc — flagged below)
  "65": "Asia/Singapore",     // Singapore
  "60": "Asia/Kuala_Lumpur",  // Malaysia
  "234": "Africa/Lagos",      // Nigeria
  "27": "Africa/Johannesburg",// South Africa
  "49": "Europe/Berlin",      // Germany
  "33": "Europe/Paris",       // France
  "34": "Europe/Madrid",      // Spain
  "39": "Europe/Rome",        // Italy
  "20": "Africa/Cairo",       // Egypt
  "880": "Asia/Dhaka",        // Bangladesh
  "94": "Asia/Colombo",       // Sri Lanka
};

// US/Canada area code -> timezone (NANP). Not exhaustive, but covers the major ones.
const NANP_AREA_CODE_TIMEZONES: Record<string, string> = {
  // Eastern
  "212": "America/New_York", "718": "America/New_York", "917": "America/New_York",
  "617": "America/New_York", "202": "America/New_York", "305": "America/New_York",
  // Central
  "312": "America/Chicago", "713": "America/Chicago", "214": "America/Chicago",
  "615": "America/Chicago", "504": "America/Chicago",
  // Mountain
  "303": "America/Denver", "602": "America/Phoenix", "801": "America/Denver",
  // Pacific
  "310": "America/Los_Angeles", "415": "America/Los_Angeles", "206": "America/Los_Angeles",
  "702": "America/Los_Angeles",
};

/**
 * Best-effort timezone detection from an E.164 phone number.
 * Falls back to Asia/Karachi (your primary market) if nothing matches.
 */
export function getTimezoneForPhone(phone: string): string {
  const digits = phone.replace(/^\+/, "");

  // US/Canada: +1 followed by a 3-digit area code
  if (digits.startsWith("1") && digits.length === 11) {
    const areaCode = digits.slice(1, 4);
    if (NANP_AREA_CODE_TIMEZONES[areaCode]) {
      return NANP_AREA_CODE_TIMEZONES[areaCode];
    }
    return "America/New_York"; // reasonable US default if area code isn't in our table
  }

  // Try longest country code match first (e.g. "971" before "97" before "9")
  const sortedCodes = Object.keys(COUNTRY_CODE_TIMEZONES).sort((a, b) => b.length - a.length);
  for (const code of sortedCodes) {
    if (digits.startsWith(code)) {
      return COUNTRY_CODE_TIMEZONES[code];
    }
  }

  return "Asia/Karachi"; // default fallback
}

/**
 * Returns true if it's currently within [startHour, endHour) local time in the given timezone.
 */
export function isWithinCallableWindow(
  timezone: string,
  startHour: number,
  endHour: number
): boolean {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(new Date());

  const localHour = parseInt(hourStr, 10);
  return localHour >= startHour && localHour < endHour;
}