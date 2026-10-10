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
