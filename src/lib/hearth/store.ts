import { create } from "zustand";
import type { AgentTurn, HouseholdState } from "./types";
import { createHousehold } from "./seed";

type HearthStore = {
  household: HouseholdState;
  turns: AgentTurn[];
  alexaOpen: boolean;
  mcpOpen: boolean;
  speaking: boolean;
  muted: boolean;
  queuedAsk: string | null;
  setHousehold: (household: HouseholdState) => void;
  setAlexaOpen: (open: boolean) => void;
  setMcpOpen: (open: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  setMuted: (muted: boolean) => void;
  setQueuedAsk: (ask: string | null) => void;
  addTurn: (turn: AgentTurn) => void;
  reset: () => void;
};

export const useHearth = create<HearthStore>()((set) => ({
  household: createHousehold(),
  turns: [],
  alexaOpen: false,
  mcpOpen: false,
  speaking: false,
  muted: true,
  queuedAsk: null,
  setHousehold: (household) => set({ household }),
  setAlexaOpen: (alexaOpen) => set({ alexaOpen }),
  setMcpOpen: (mcpOpen) => set({ mcpOpen }),
  setSpeaking: (speaking) => set({ speaking }),
  setMuted: (muted) => set({ muted }),
  setQueuedAsk: (queuedAsk) => set({ queuedAsk }),
  addTurn: (turn) =>
    set((s) => ({
      turns: [...s.turns, turn].slice(-16),
    })),
  reset: () =>
    set({
      household: createHousehold(),
      turns: [],
      alexaOpen: false,
      speaking: false,
      queuedAsk: null,
    }),
}));
