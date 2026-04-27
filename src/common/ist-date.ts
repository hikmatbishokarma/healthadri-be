const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function startOfDayIST(date: Date): Date {
  const istWall = new Date(date.getTime() + IST_OFFSET_MS);
  istWall.setUTCHours(0, 0, 0, 0);
  return new Date(istWall.getTime() - IST_OFFSET_MS);
}

export function dayNameIST(date: Date): string {
  const istWall = new Date(date.getTime() + IST_OFFSET_MS);
  return WEEK_DAYS[istWall.getUTCDay()];
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
