import type { HouseholdState } from "./types";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function createHousehold(): HouseholdState {
  return {
    houseName: "Adeyemi house",
    neighborhood: "Surulere",
    city: "Lagos",
    timezone: "Africa/Lagos",
    people: [
      {
        id: "tunde",
        name: "Tunde Adeyemi",
        shortName: "Tunde",
        role: "Pays the house",
        age: 36,
        presence: "away",
        location: "Victoria Island · still at work",
        lastCheckIn: hoursAgo(2.2),
        elder: false,
        note: "Said he would try to make kickoff.",
      },
      {
        id: "mama",
        name: "Mama Bisi",
        shortName: "Mama",
        role: "Runs the house",
        age: 62,
        presence: "home",
        location: "Kitchen · jollof on",
        lastCheckIn: hoursAgo(0.7),
        elder: false,
        note: "Asked if Tunde had paid DSTV.",
      },
      {
        id: "baba",
        name: "Baba Kunle",
        shortName: "Baba",
        role: "The elder",
        age: 70,
        presence: "home",
        location: "Veranda",
        lastCheckIn: hoursAgo(13),
        elder: true,
        note: "Morning tea. Has not checked in since.",
      },
      {
        id: "sade",
        name: "Sade Adeyemi",
        shortName: "Sade",
        role: "WAEC year",
        age: 17,
        presence: "out",
        location: "Lesson · back ~7:30",
        lastCheckIn: hoursAgo(9),
        elder: false,
        note: "Wants the living room after the match.",
      },
    ],
    bills: [
      {
        id: "nepa",
        name: "Light bill",
        provider: "Ikeja Electric",
        amount: 42800,
        paidAmount: 0,
        due: daysFromNow(3),
        status: "unpaid",
        paidBy: null,
        note: "Estimated. Mama wants it cleared before weekend.",
      },
      {
        id: "dstv",
        name: "DSTV Compact",
        provider: "Multichoice",
        amount: 24200,
        paidAmount: 0,
        due: daysFromNow(5),
        status: "unpaid",
        paidBy: null,
        note: "Tunde usually pays. Match night depends on it.",
      },
      {
        id: "wedding",
        name: "Family contribution",
        provider: "Aunty Nkechi's wedding",
        amount: 150000,
        paidAmount: 80000,
        due: daysFromNow(18),
        status: "partial",
        paidBy: "tunde",
        note: "Tunde sent ₦80k. ₦70k still open.",
      },
    ],
    tonight: {
      title: "Super Eagles qualifier",
      time: "8:00pm WAT",
      watching: false,
      dinner: "Jollof, fried plantain, leftover stew",
      expected: "Sade by 7:30 · Tunde if the Island lets him go",
    },
    reminders: [],
    notes: [],
    updatedAt: new Date().toISOString(),
  };
}

export const SUGGESTED_ASKS = [
  "Is everyone home?",
  "Has Baba checked in today?",
  "What's left on the light bill?",
  "Mark DSTV as paid by Tunde",
  "Put tonight's match on",
  "Tell Mama I'm on my way",
] as const;
