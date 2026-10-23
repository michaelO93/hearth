export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const delta = now - then;
  const min = Math.round(delta / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

export function dueLabel(iso: string, now = Date.now()): string {
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function presenceLabel(presence: "home" | "out" | "away"): string {
  if (presence === "home") return "Home";
  if (presence === "away") return "Away";
  return "Out";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function plural(n: string, unit: string): string {
  return `${n} ${unit}${n === "1" ? "" : "s"}`;
}

// Board text is written for the eye ("out · Lesson · back ~7:30", "₦70k", "9h ago").
// Rewrite it for the ear before it reaches Polly or the browser voice.
export function forSpeech(text: string): string {
  return text
    .replace(/\s*·\s*/g, ", ")
    .replace(/\s+\/\s+/g, " of ")
    .replace(/~\s*/g, "about ")
    .replace(/₦\s?(\d(?:[\d,.]*\d)?)\s?k\b/gi, "$1 thousand naira")
    .replace(/₦\s?(\d(?:[\d,.]*\d)?)/g, "$1 naira")
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, _y, m, d) => `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`)
    .replace(/\b(\d+)m\b/g, (_, n) => plural(n, "minute"))
    .replace(/\b(\d+)h\b/g, (_, n) => plural(n, "hour"))
    .replace(/\b(\d+)d\b/g, (_, n) => plural(n, "day"))
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}
