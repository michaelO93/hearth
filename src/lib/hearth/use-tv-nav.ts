import { useCallback, useEffect, useState } from "react";

export function useTvNav(opts: {
  rows: string[][];
  enabled: boolean;
  onActivate: (id: string) => void;
  onBack?: () => void;
  onAlexa?: () => void;
}) {
  const { rows, enabled, onActivate, onBack, onAlexa } = opts;
  const [focusId, setFocusId] = useState(rows[0]?.[0] ?? "");

  const findPos = useCallback(
    (id: string) => {
      for (let r = 0; r < rows.length; r++) {
        const c = rows[r]?.indexOf(id) ?? -1;
        if (c >= 0) return { r, c };
      }
      return { r: 0, c: 0 };
    },
    [rows],
  );

  useEffect(() => {
    const ids = rows.flat();
    if (ids.length && !ids.includes(focusId)) {
      setFocusId(ids[0] ?? "");
    }
  }, [rows, focusId]);

  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (e.key === "Escape") {
          e.preventDefault();
          onBack?.();
        }
        return;
      }

      if (e.key === "a" || e.key === "A" || e.key === " ") {
        if (e.key === " " && target?.tagName === "BUTTON") return;
        e.preventDefault();
        onAlexa?.();
        return;
      }

      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        onBack?.();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        onActivate(focusId);
        return;
      }

      const pos = findPos(focusId);
      let { r, c } = pos;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const row = rows[r] ?? [];
        c = Math.min(row.length - 1, c + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        c = Math.max(0, c - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        r = Math.min(rows.length - 1, r + 1);
        const row = rows[r] ?? [];
        c = Math.min(c, Math.max(0, row.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        r = Math.max(0, r - 1);
        const row = rows[r] ?? [];
        c = Math.min(c, Math.max(0, row.length - 1));
      } else {
        return;
      }

      const next = rows[r]?.[c];
      if (next) setFocusId(next);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, findPos, focusId, onActivate, onAlexa, onBack, rows]);

  return { focusId, setFocusId };
}
