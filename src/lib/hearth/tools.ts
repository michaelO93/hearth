import type { HouseholdState, ToolResult } from "./types";
import { naira, relativeTime } from "./format";

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required?: string[];
  additionalProperties: false;
};

export type HearthTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

const emptyObject: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const HEARTH_TOOLS: HearthTool[] = [
  {
    name: "get_household_status",
    description:
      "Overview of the Adeyemi house: who is where, overdue check-ins, unpaid bills, and tonight's plan.",
    inputSchema: emptyObject,
  },
  {
    name: "get_people",
    description: "List household members with presence, last check-in, and location.",
    inputSchema: emptyObject,
  },
  {
    name: "get_bills",
    description: "List household bills with amounts, due dates, and who paid.",
    inputSchema: emptyObject,
  },
  {
    name: "record_checkin",
    description:
      "Record that a person is fine / checked in now. Use for 'I'm fine', 'Baba checked in', or an elder tap.",
    inputSchema: {
      type: "object",
      properties: {
        personId: {
          type: "string",
          description: "Person id: tunde | mama | baba | sade",
        },
      },
      required: ["personId"],
      additionalProperties: false,
    },
  },
  {
    name: "set_presence",
    description: "Update whether someone is home, out, or away, with an optional location note.",
    inputSchema: {
      type: "object",
      properties: {
        personId: {
          type: "string",
          description: "Person id: tunde | mama | baba | sade",
        },
        presence: {
          type: "string",
          enum: ["home", "out", "away"],
          description: "home, out, or away",
        },
        location: {
          type: "string",
          description: "Short location, e.g. 'On the Third Mainland' or 'Kitchen'",
        },
      },
      required: ["personId", "presence"],
      additionalProperties: false,
    },
  },
  {
    name: "pay_bill",
    description: "Mark a bill paid or partially paid by a household member.",
    inputSchema: {
      type: "object",
      properties: {
        billId: {
          type: "string",
          description: "Bill id: nepa | dstv | wedding",
        },
        paidBy: {
          type: "string",
          description: "Person id who paid",
        },
        amount: {
          type: "number",
          description: "Optional amount in naira. Omit to pay the remaining balance in full.",
        },
      },
      required: ["billId", "paidBy"],
      additionalProperties: false,
    },
  },
  {
    name: "set_tonight",
    description: "Update match night: whether the house is watching, or dinner/expected notes.",
    inputSchema: {
      type: "object",
      properties: {
        watching: {
          type: "boolean",
          description: "Put the match on the living-room board",
        },
        note: {
          type: "string",
          description: "Optional note about dinner or who is expected",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "add_note",
    description: "Leave a short note on the family board, optionally for a specific person.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Note to pin on the board" },
        personId: {
          type: "string",
          description: "Optional person id the note is for",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "add_reminder",
    description: "Set a reminder for a household member.",
    inputSchema: {
      type: "object",
      properties: {
        forPersonId: { type: "string", description: "Person id" },
        text: { type: "string", description: "What to remember" },
      },
      required: ["forPersonId", "text"],
      additionalProperties: false,
    },
  },
];

export function toOpenAiTools() {
  return HEARTH_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function findPerson(state: HouseholdState, id: string) {
  const key = id.trim().toLowerCase();
  return state.people.find(
    (p) => p.id === key || p.shortName.toLowerCase() === key || p.name.toLowerCase().includes(key),
  );
}

function findBill(state: HouseholdState, id: string) {
  const key = id.trim().toLowerCase();
  return state.bills.find(
    (b) => b.id === key || b.name.toLowerCase().includes(key) || b.provider.toLowerCase().includes(key),
  );
}

function stamp(state: HouseholdState): HouseholdState {
  return { ...state, updatedAt: new Date().toISOString() };
}

function statusText(state: HouseholdState): string {
  const people = state.people
    .map((p) => {
      const check = p.lastCheckIn ? relativeTime(p.lastCheckIn) : "never";
      return `${p.shortName} (${p.role}): ${p.presence} · ${p.location} · checked in ${check}`;
    })
    .join("\n");
  const bills = state.bills
    .map((b) => {
      const remain = b.amount - b.paidAmount;
      return `${b.name}: ${b.status}, ${naira(remain)} remaining of ${naira(b.amount)}, due ${b.due.slice(0, 10)}`;
    })
    .join("\n");
  const watch = state.tonight.watching ? "ON the board" : "not put on yet";
  return [
    `${state.houseName}, ${state.neighborhood}, ${state.city}.`,
    people,
    bills,
    `Tonight: ${state.tonight.title} at ${state.tonight.time} (${watch}). Dinner: ${state.tonight.dinner}. ${state.tonight.expected}.`,
    state.reminders.length
      ? `Reminders: ${state.reminders.map((r) => r.text).join("; ")}`
      : "No reminders.",
  ].join("\n\n");
}

export function executeTool(
  state: HouseholdState,
  name: string,
  rawArgs: Record<string, unknown> | undefined,
): ToolResult {
  const args = rawArgs ?? {};
  const next = structuredClone(state);

  if (name === "get_household_status") {
    return { state, text: statusText(state) };
  }

  if (name === "get_people") {
    return {
      state,
      text: state.people
        .map((p) => `${p.shortName}: ${p.presence} · ${p.location} · last check-in ${relativeTime(p.lastCheckIn)}`)
        .join("\n"),
    };
  }

  if (name === "get_bills") {
    return {
      state,
      text: state.bills
        .map((b) => {
          const remain = b.amount - b.paidAmount;
          const who = b.paidBy ? ` paid by ${b.paidBy}` : "";
          return `${b.id} ${b.name} (${b.provider}): ${naira(remain)} left / ${naira(b.amount)} · ${b.status}${who}`;
        })
        .join("\n"),
    };
  }

  if (name === "record_checkin") {
    const person = findPerson(next, String(args.personId ?? ""));
    if (!person) return { state, text: "I don't know that person." };
    person.lastCheckIn = new Date().toISOString();
    person.note = "Checked in. I'm fine.";
    if (person.presence === "out" || person.presence === "away") {
      /* keep presence — a check-in can happen from away */
    }
    return {
      state: stamp(next),
      text: `${person.shortName} checked in at ${new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}.`,
    };
  }

  if (name === "set_presence") {
    const person = findPerson(next, String(args.personId ?? ""));
    if (!person) return { state, text: "I don't know that person." };
    const presence = String(args.presence);
    if (presence !== "home" && presence !== "out" && presence !== "away") {
      return { state, text: "Presence must be home, out, or away." };
    }
    person.presence = presence;
    if (typeof args.location === "string" && args.location.trim()) {
      person.location = args.location.trim();
    }
    person.lastCheckIn = new Date().toISOString();
    return {
      state: stamp(next),
      text: `${person.shortName} is now ${presence}${person.location ? ` · ${person.location}` : ""}.`,
    };
  }

  if (name === "pay_bill") {
    const bill = findBill(next, String(args.billId ?? ""));
    if (!bill) return { state, text: "I don't know that bill." };
    const payer = findPerson(next, String(args.paidBy ?? ""));
    if (!payer) return { state, text: "I don't know who paid." };
    const remaining = bill.amount - bill.paidAmount;
    const amount =
      typeof args.amount === "number" && Number.isFinite(args.amount) ? args.amount : remaining;
    bill.paidAmount = Math.min(bill.amount, bill.paidAmount + amount);
    bill.paidBy = payer.id;
    bill.status = bill.paidAmount >= bill.amount ? "paid" : bill.paidAmount > 0 ? "partial" : "unpaid";
    return {
      state: stamp(next),
      text: `${payer.shortName} paid ${naira(amount)} toward ${bill.name}. Status: ${bill.status}. ${naira(bill.amount - bill.paidAmount)} remaining.`,
    };
  }

  if (name === "set_tonight") {
    if (typeof args.watching === "boolean") next.tonight.watching = args.watching;
    if (typeof args.note === "string" && args.note.trim()) {
      next.tonight.expected = args.note.trim();
    }
    return {
      state: stamp(next),
      text: next.tonight.watching
        ? `${next.tonight.title} is on the living-room board at ${next.tonight.time}.`
        : `${next.tonight.title} is no longer on the board.`,
    };
  }

  if (name === "add_note") {
    const text = String(args.text ?? "").trim();
    if (!text) return { state, text: "Need a note." };
    const person = args.personId ? findPerson(next, String(args.personId)) : undefined;
    if (person) person.note = text;
    next.notes.unshift({
      id: `n-${Date.now()}`,
      text: person ? `For ${person.shortName}: ${text}` : text,
      at: new Date().toISOString(),
    });
    next.notes = next.notes.slice(0, 8);
    return { state: stamp(next), text: `Pinned: ${text}` };
  }

  if (name === "add_reminder") {
    const person = findPerson(next, String(args.forPersonId ?? ""));
    if (!person) return { state, text: "I don't know that person." };
    const text = String(args.text ?? "").trim();
    if (!text) return { state, text: "Need reminder text." };
    next.reminders.unshift({
      id: `r-${Date.now()}`,
      forPersonId: person.id,
      text,
      createdAt: new Date().toISOString(),
    });
    return { state: stamp(next), text: `Reminder for ${person.shortName}: ${text}` };
  }

  return { state, text: `Unknown tool: ${name}` };
}

export function toolSummary(name: string): string {
  switch (name) {
    case "get_household_status":
      return "Read the house";
    case "get_people":
      return "Checked who's home";
    case "get_bills":
      return "Checked the bills";
    case "record_checkin":
      return "Recorded a check-in";
    case "set_presence":
      return "Updated presence";
    case "pay_bill":
      return "Updated a bill";
    case "set_tonight":
      return "Updated tonight";
    case "add_note":
      return "Pinned a note";
    case "add_reminder":
      return "Set a reminder";
    default:
      return name;
  }
}

/** Offline fallback when xAI is unavailable — still mutates the board. */
export function localIntent(utterance: string, state: HouseholdState): ToolResult {
  const q = utterance.toLowerCase();
  let current = state;
  const logs: string[] = [];

  const run = (name: string, args: Record<string, unknown> = {}) => {
    const result = executeTool(current, name, args);
    current = result.state;
    logs.push(result.text);
    return result;
  };

  if (/baba/.test(q) && /(check|fine|ok|okay|alright)/.test(q)) {
    run("record_checkin", { personId: "baba" });
    return { state: current, text: logs.join(" ") };
  }
  if (/dstv|dstv|multichoice/.test(q) && /paid|pay/.test(q)) {
    run("pay_bill", { billId: "dstv", paidBy: "tunde" });
    return { state: current, text: logs.join(" ") };
  }
  if (/nepa|light bill|electric/.test(q) && /paid|pay/.test(q)) {
    run("pay_bill", { billId: "nepa", paidBy: "tunde" });
    return { state: current, text: logs.join(" ") };
  }
  if (/match|put .*on|watch|qualifier/.test(q)) {
    run("set_tonight", { watching: true });
    return { state: current, text: logs.join(" ") };
  }
  if (/on my way|coming home|leaving work/.test(q)) {
    run("set_presence", {
      personId: "tunde",
      presence: "away",
      location: "On the way home",
    });
    run("add_note", { text: "Tunde is on his way.", personId: "mama" });
    return {
      state: current,
      text: "Told Mama. Tunde is on his way.",
    };
  }
  if (/where is|where's/.test(q)) {
    const who = q
      .replace(/.*where(?:'s| is)\s*/, "")
      .replace(/[?.!,]+$/g, "")
      .trim();
    const person = findPerson(current, who);
    if (person) {
      return {
        state: current,
        text: `${person.shortName} is ${person.presence} · ${person.location}. Last check-in ${relativeTime(person.lastCheckIn)}.`,
      };
    }
  }
  if (/what'?s left on|how much.*left|balance.*on|remaining on/.test(q)) {
    const bill = current.bills.find(
      (b) =>
        q.includes(b.id) ||
        q.includes(b.name.toLowerCase()) ||
        q.includes(b.provider.toLowerCase()) ||
        (b.id === "nepa" && /light|electric/.test(q)) ||
        (b.id === "wedding" && /wedding|nkechi|contribution/.test(q)),
    );
    if (bill) {
      const remain = bill.amount - bill.paidAmount;
      return {
        state: current,
        text: `${bill.name}: ${naira(remain)} left of ${naira(bill.amount)} · ${bill.status}, due ${bill.due.slice(0, 10)}.`,
      };
    }
  }
  if (/who.*(clear|pay|settle|handle)|whose turn/.test(q)) {
    const unpaid = current.bills.filter((b) => b.status !== "paid");
    if (!unpaid.length) return { state: current, text: "Nothing open. The house is clear." };
    return {
      state: current,
      text: `Tunde pays the house. Open: ${unpaid.map((b) => `${b.name} (${naira(b.amount - b.paidAmount)} left)`).join("; ")}.`,
    };
  }
  if (/who.*(home|here)|everyone|who's home|whos home/.test(q)) {
    run("get_people");
    const home = current.people.filter((p) => p.presence === "home").map((p) => p.shortName);
    const out = current.people.filter((p) => p.presence !== "home").map((p) => p.shortName);
    return {
      state: current,
      text: `${home.join(" and ") || "Nobody"} at home. ${out.join(" and ")} not in.`,
    };
  }
  if (/bill|nepa|dstv|money|naira/.test(q)) {
    const unpaid = current.bills.filter((b) => b.status !== "paid");
    const total = unpaid.reduce((s, b) => s + (b.amount - b.paidAmount), 0);
    return {
      state: current,
      text: `${unpaid.length} open. ${naira(total)} still to clear. Light bill and DSTV are the near ones.`,
    };
  }
  if (/baba|elder|check-in|check in/.test(q)) {
    const baba = current.people.find((p) => p.id === "baba");
    return {
      state: current,
      text: `Baba is ${baba?.presence}. Last check-in ${relativeTime(baba?.lastCheckIn ?? null)}.`,
    };
  }

  return {
    state,
    text: "I can tell you who's home, the bills, Baba's check-in, or put the match on.",
  };
}
