/** Opening-hours logic, fixed to Asia/Jerusalem. Format: "HH:MM-HH:MM" | "closed". */

const DAY_KEYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

function ilParts(now: Date): { dayIdx: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { dayIdx, minutes: hour * 60 + minute };
}

function parseRange(s: string): { start: number; end: number } | null {
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return {
    start: parseInt(m[1]) * 60 + parseInt(m[2]),
    end: parseInt(m[3]) * 60 + parseInt(m[4]),
  };
}

export function isOpenNow(
  hours: Record<string, string | null | undefined>,
  now: Date = new Date()
): boolean {
  const { dayIdx, minutes } = ilParts(now);

  // Today's window
  const today = (hours[DAY_KEYS[dayIdx]] ?? "").trim().toLowerCase();
  if (today && today !== "closed") {
    const r = parseRange(today);
    if (r) {
      if (r.end > r.start) {
        if (minutes >= r.start && minutes < r.end) return true;
      } else if (minutes >= r.start) {
        return true; // overnight, before midnight
      }
    }
  }

  // Yesterday's overnight window may extend into this morning.
  const yIdx = (dayIdx + 6) % 7;
  const yesterday = (hours[DAY_KEYS[yIdx]] ?? "").trim().toLowerCase();
  if (yesterday && yesterday !== "closed") {
    const r = parseRange(yesterday);
    if (r && r.end < r.start && minutes < r.end) return true;
  }

  return false;
}
