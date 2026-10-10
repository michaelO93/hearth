import { Clock, Mic, Radio, RotateCcw, Tv2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { dueLabel, initials, naira, presenceLabel, relativeTime } from "@/lib/hearth/format";
import { isCheckInStale, pickHero } from "@/lib/hearth/hero";
import { useHearth } from "@/lib/hearth/store";
import { cn } from "@/lib/utils";
import type { Bill, Person } from "@/lib/hearth/types";

function Tile({
  id,
  focused,
  onFocus,
  onActivate,
  className,
  children,
}: {
  id: string;
  focused: boolean;
  onFocus: (id: string) => void;
  onActivate: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-tv-id={id}
      onMouseEnter={() => onFocus(id)}
      onFocus={() => onFocus(id)}
      onClick={() => onActivate(id)}
      className={cn(
        "tv-tile rounded-lg bg-elevated text-left outline-none",
        focused && "is-focused",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ClockFace() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) {
    return <div className="h-8 w-40" />;
  }
  const time = now.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return (
    <div className="flex items-baseline gap-3 tabular-nums">
      <span className="font-display text-2xl font-medium tracking-tight text-fg sm:text-3xl">{time}</span>
      <span className="text-sm text-muted">{date} · WAT</span>
    </div>
  );
}

function PresenceDot({ presence }: { presence: Person["presence"] }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        presence === "home" && "bg-home",
        presence === "away" && "bg-away",
        presence === "out" && "bg-subtle",
      )}
      aria-hidden
    />
  );
}

function PersonCard({ person }: { person: Person }) {
  const stale = isCheckInStale(person);
  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-md bg-surface font-display text-lg text-accent sm:size-12",
            stale && "text-ember",
          )}
        >
          {initials(person.name)}
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted">
          <PresenceDot presence={person.presence} />
          {presenceLabel(person.presence)}
        </div>
      </div>
      <div>
        <div className="font-display text-xl font-medium tracking-tight text-fg">{person.shortName}</div>
        <div className="mt-0.5 text-sm text-muted">{person.role}</div>
      </div>
      <p className="mt-auto text-sm leading-snug text-fg/80">{person.location}</p>
      <div className="flex items-center justify-between text-xs text-subtle">
        <span suppressHydrationWarning>Checked in {relativeTime(person.lastCheckIn)}</span>
        {stale ? <span className="text-ember">Overdue</span> : null}
      </div>
    </div>
  );
}

function BillCard({ bill }: { bill: Bill }) {
  const remain = bill.amount - bill.paidAmount;
  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted">
        <span>{bill.provider}</span>
        <Wallet className="size-3.5" strokeWidth={1.75} />
      </div>
      <div className="font-display text-lg font-medium tracking-tight">{bill.name}</div>
      <div className="mt-auto">
        <div className="font-display text-xl tabular-nums tracking-tight whitespace-nowrap sm:text-2xl">{naira(remain)}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>{dueLabel(bill.due)}</span>
          <span className={cn(bill.status === "paid" && "text-home", bill.status === "unpaid" && "text-ember")}>
            {bill.status === "paid" ? "Cleared" : bill.status === "partial" ? "Partial" : "Open"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FamilyBoard({
  focusId,
  onFocus,
  onActivate,
}: {
  focusId: string;
  onFocus: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const household = useHearth((s) => s.household);
  const hero = useMemo(() => pickHero(household), [household]);
  const watching = household.tonight.watching;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 pb-28 pt-4 sm:gap-4 sm:px-8 sm:pb-24 sm:pt-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted">Living room · Alexa+</div>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-fg sm:text-4xl">
            {household.houseName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {household.neighborhood}, {household.city}
          </p>
        </div>
        <ClockFace />
      </header>

      <Tile
        id="hero"
        focused={focusId === "hero"}
        onFocus={onFocus}
        onActivate={onActivate}
        className="rounded-xl bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              {hero.kind === "elder" ? <Radio className="size-3.5 text-ember" /> : <Tv2 className="size-3.5" />}
              {hero.kicker}
            </div>
            <h2 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              {hero.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{hero.body}</p>
          </div>
          {hero.action ? (
            <div className="shrink-0 rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-fg">
              {hero.action.label}
            </div>
          ) : null}
        </div>
      </Tile>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {household.people.map((person) => (
          <Tile
            key={person.id}
            id={`person:${person.id}`}
            focused={focusId === `person:${person.id}`}
            onFocus={onFocus}
            onActivate={onActivate}
            className="min-h-[160px] sm:min-h-[176px]"
          >
            <PersonCard person={person} />
          </Tile>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4">
        {household.bills.map((bill) => (
          <Tile
            key={bill.id}
            id={`bill:${bill.id}`}
            focused={focusId === `bill:${bill.id}`}
            onFocus={onFocus}
            onActivate={onActivate}
            className="min-h-[150px]"
          >
            <BillCard bill={bill} />
          </Tile>
        ))}
        <Tile
          id="tonight"
          focused={focusId === "tonight"}
          onFocus={onFocus}
          onActivate={onActivate}
          className="min-h-[150px]"
        >
          <div className="flex h-full flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted">
              <span>Tonight</span>
              <Clock className="size-3.5" strokeWidth={1.75} />
            </div>
            <div className="font-display text-lg font-medium tracking-tight">{household.tonight.title}</div>
            <p className="text-sm text-muted">{household.tonight.time}</p>
            <div className="mt-auto text-xs uppercase tracking-[0.14em]">
              {watching ? <span className="text-home">On the board</span> : <span className="text-subtle">Not on yet</span>}
            </div>
          </div>
        </Tile>
      </section>
    </div>
  );
}

export function TvChrome({
  focusId,
  onFocus,
  onActivate,
}: {
  focusId: string;
  onFocus: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const reset = useHearth((s) => s.reset);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 hidden h-16 bg-gradient-to-b from-bg to-transparent sm:block" />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-3 py-3 backdrop-blur-sm sm:inset-x-auto sm:bottom-6 sm:left-8 sm:right-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 sm:mx-0">
          <Tile
            id="alexa"
            focused={focusId === "alexa"}
            onFocus={onFocus}
            onActivate={onActivate}
            className="flex flex-1 items-center gap-3 rounded-md px-4 py-3 sm:flex-none sm:px-5"
          >
            <span className="orb grid size-8 place-items-center rounded-full">
              <Mic className="size-3.5 text-accent-fg" strokeWidth={2} />
            </span>
            <span className="text-sm font-medium">Ask Hearth</span>
            <span className="hidden text-xs text-muted sm:inline">A or Space</span>
          </Tile>
          <Tile
            id="mcp"
            focused={focusId === "mcp"}
            onFocus={onFocus}
            onActivate={onActivate}
            className="hidden rounded-md px-4 py-3 text-sm text-muted sm:block"
          >
            MCP
          </Tile>
          <button
            type="button"
            onClick={() => reset()}
            className="hidden size-11 place-items-center rounded-md text-muted hover:text-fg sm:grid"
            aria-label="Reset the house"
          >
            <RotateCcw className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </nav>
    </>
  );
}
