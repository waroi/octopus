export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getSundayOfWeek(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatWeekLabel(monday: Date, now: Date): string {
  const currentMonday = getMondayOfWeek(now);
  const currentMondayStr = currentMonday.toISOString().split("T")[0];
  const mondayStr = monday.toISOString().split("T")[0];

  const lastMonday = new Date(currentMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastMondayStr = lastMonday.toISOString().split("T")[0];

  if (mondayStr === currentMondayStr) return "This Week";
  if (mondayStr === lastMondayStr) return "Last Week";

  const weekNum = getISOWeekNumber(monday);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const monthFmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short" });
  const start = `${monthFmt(monday)} ${monday.getDate()}`;
  const end = `${monthFmt(sunday)} ${sunday.getDate()}`;

  return `Week ${weekNum} \u00b7 ${start}\u2013${end}, ${monday.getFullYear()}`;
}

export function weekInputToMonday(weekValue: string): Date {
  // weekValue = "2026-W08"
  const [yearStr, weekStr] = weekValue.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const jan4Monday = getMondayOfWeek(jan4);
  const result = new Date(jan4Monday);
  result.setDate(result.getDate() + (week - 1) * 7);
  return result;
}
