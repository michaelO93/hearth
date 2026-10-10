import type { Bill, HouseholdState, Person } from "./types";

export type HeroKind = "elder" | "bill" | "tonight" | "calm";

export type Hero = {
  kind: HeroKind;
  kicker: string;
  title: string;
  body: string;
  action?: { id: string; label: string };
  person?: Person;
  bill?: Bill;
};

const ELDER_STALE_MS = 6 * 3600 * 1000;

export function checkInAgeMs(iso: string | null, now = Date.now()): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return now - new Date(iso).getTime();
}

export function isCheckInStale(person: Person, now = Date.now()): boolean {
  if (!person.elder) return false;
  if (person.presence !== "home") return false;
  return checkInAgeMs(person.lastCheckIn, now) > ELDER_STALE_MS;
}

export function pickHero(state: HouseholdState, now = Date.now()): Hero {
  const staleElder = state.people.find((p) => isCheckInStale(p, now));
  if (staleElder) {
    const hours = Math.max(1, Math.round(checkInAgeMs(staleElder.lastCheckIn, now) / 3600000));
    return {
      kind: "elder",
      kicker: "Needs a check-in",
      title: `${staleElder.shortName} hasn't checked in`,
      body: `Last seen ${hours} hours ago, still on the veranda. One word from him — or from you — clears the board.`,
      action: { id: `checkin:${staleElder.id}`, label: "I'm fine" },
      person: staleElder,
    };
  }

  const urgentBill = state.bills
    .filter((b) => b.status !== "paid")
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())[0];
  if (urgentBill) {
    const remain = urgentBill.amount - urgentBill.paidAmount;
    return {
      kind: "bill",
      kicker: urgentBill.provider,
      title: `${urgentBill.name} is still open`,
      body: `${remain.toLocaleString("en-NG")} naira remaining. ${urgentBill.note}`,
      action: { id: `bill:${urgentBill.id}`, label: "Ask Hearth about bills" },
      bill: urgentBill,
    };
  }

  if (state.tonight.watching) {
    return {
      kind: "tonight",
      kicker: state.tonight.time,
      title: state.tonight.title,
      body: `On the board. ${state.tonight.dinner}. ${state.tonight.expected}.`,
    };
  }

  return {
    kind: "tonight",
    kicker: "Tonight",
    title: state.tonight.title,
    body: `${state.tonight.time}. ${state.tonight.dinner}. Not on the TV yet — ask Hearth to put it on.`,
    action: { id: "tonight:on", label: "Put the match on" },
  };
}
