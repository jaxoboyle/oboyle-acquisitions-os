export function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function endOfCurrentMonth(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 0);
}

/** End of the current Sunday–Saturday week (Saturday) — matches the Mon-Sat
 * 10hr / Sun 3hr schedule already used elsewhere (e.g. work-session's
 * weekStart logic). */
export function endOfCurrentWeek(from: Date): Date {
  const d = new Date(from);
  const daysUntilSaturday = 6 - d.getDay();
  d.setDate(d.getDate() + daysUntilSaturday);
  return d;
}
