/** Formats a raw phone number + country code into E.164. Returns null if invalid. */
export function toE164(countryCode: string, rawNumber: string): string | null {
  const ccDigits = countryCode.replace(/[^\d]/g, "");
  const numberDigits = rawNumber.replace(/[^\d]/g, "");

  if (!/^\d{1,3}$/.test(ccDigits)) return null;
  if (numberDigits.length < 7 || numberDigits.length > 14) return null;

  return `+${ccDigits}${numberDigits}`;
}

export function last4(e164: string): string {
  return e164.slice(-4);
}
