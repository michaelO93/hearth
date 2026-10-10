import type { HouseholdState } from "./types";
import { pickHero } from "./hero";
import { executeTool } from "./tools";

export function applyBoardAction(
  id: string,
  household: HouseholdState,
  setHousehold: (next: HouseholdState) => void,
): { utterance?: string; alexa?: boolean; mcp?: boolean } {
  if (id === "alexa") return { alexa: true };
  if (id === "mcp") return { mcp: true };

  if (id === "hero") {
    const hero = pickHero(household);
    if (hero.action?.id.startsWith("checkin:")) {
      const personId = hero.action.id.split(":")[1] ?? "baba";
      setHousehold(executeTool(household, "record_checkin", { personId }).state);
      return {};
    }
    if (hero.action?.id === "tonight:on") {
      setHousehold(executeTool(household, "set_tonight", { watching: true }).state);
      return {};
    }
    if (hero.action?.id?.startsWith("bill:")) {
      return { alexa: true, utterance: "What's left on the bills?" };
    }
    return { alexa: true };
  }

  if (id === "tonight") {
    setHousehold(executeTool(household, "set_tonight", { watching: !household.tonight.watching }).state);
    return {};
  }

  if (id.startsWith("person:")) {
    const personId = id.slice("person:".length);
    const person = household.people.find((p) => p.id === personId);
    if (person?.elder) {
      setHousehold(executeTool(household, "record_checkin", { personId }).state);
      return {};
    }
    return { alexa: true, utterance: `Where is ${person?.shortName ?? "they"}?` };
  }

  if (id.startsWith("bill:")) {
    const billId = id.slice("bill:".length);
    const bill = household.bills.find((b) => b.id === billId);
    return { alexa: true, utterance: `What's left on ${bill?.name ?? "the bills"}?` };
  }

  return {};
}
