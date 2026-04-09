export const OMAN_WEEKEND_DAYS = [5, 6] as const;

export const OMAN_PUBLIC_HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-03-30",
  "2026-03-31",
  "2026-04-01",
  "2026-06-06",
  "2026-06-07",
  "2026-06-08",
  "2026-06-09",
  "2026-06-26",
  "2026-07-23",
  "2026-09-04",
  "2026-11-18",
  "2026-11-19",
] as const;

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toLocalMidday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function isOmanWeekend(date: Date): boolean {
  return OMAN_WEEKEND_DAYS.includes(date.getDay() as (typeof OMAN_WEEKEND_DAYS)[number]);
}

export function isOmanPublicHoliday(date: Date): boolean {
  return OMAN_PUBLIC_HOLIDAYS_2026.includes(toIsoDate(toLocalMidday(date)) as (typeof OMAN_PUBLIC_HOLIDAYS_2026)[number]);
}

export function isOmanWorkingDay(date: Date): boolean {
  return !isOmanWeekend(date) && !isOmanPublicHoliday(date);
}

export function countCalendarDays(startDate: Date, endDate: Date): number {
  const start = toLocalMidday(startDate);
  const end = toLocalMidday(endDate);
  if (end < start) {
    return 0;
  }
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function countWorkingDays(startDate: Date, endDate: Date): number {
  const start = toLocalMidday(startDate);
  const end = toLocalMidday(endDate);
  if (end < start) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isOmanWorkingDay(cursor)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function getNextWorkingDay(date: Date): Date {
  const cursor = toLocalMidday(date);
  while (!isOmanWorkingDay(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return cursor;
}

export function disabledDatesForPicker(year: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(year, 0, 1, 12, 0, 0, 0);
  const end = new Date(year, 11, 31, 12, 0, 0, 0);
  while (cursor <= end) {
    if (isOmanWeekend(cursor) || isOmanPublicHoliday(cursor)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
