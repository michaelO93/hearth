import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { applyBoardAction } from "@/lib/hearth/actions";
import { AlexaOverlay } from "@/components/hearth/alexa-overlay";
import { FamilyBoard, TvChrome } from "@/components/hearth/family-board";
import { McpPanel } from "@/components/hearth/mcp-panel";
import { useHearth } from "@/lib/hearth/store";
import { useTvNav } from "@/lib/hearth/use-tv-nav";

export const Route = createFileRoute("/")({ component: LivingRoom });

function LivingRoom() {
  const household = useHearth((s) => s.household);
  const alexaOpen = useHearth((s) => s.alexaOpen);
  const mcpOpen = useHearth((s) => s.mcpOpen);
  const setAlexaOpen = useHearth((s) => s.setAlexaOpen);
  const setMcpOpen = useHearth((s) => s.setMcpOpen);
  const setQueuedAsk = useHearth((s) => s.setQueuedAsk);
  const setHousehold = useHearth((s) => s.setHousehold);

  const rows = useMemo(() => {
    return [
      ["hero"],
      household.people.map((p) => `person:${p.id}`),
      [...household.bills.map((b) => `bill:${b.id}`), "tonight"],
      ["alexa", "mcp"],
    ];
  }, [household.people, household.bills]);

  const onActivate = useCallback(
    (id: string) => {
      const result = applyBoardAction(id, household, setHousehold);
      if (result.mcp) setMcpOpen(true);
      if (result.alexa) {
        if (result.utterance) setQueuedAsk(result.utterance);
        setAlexaOpen(true);
      }
    },
    [household, setAlexaOpen, setHousehold, setMcpOpen, setQueuedAsk],
  );

  const { focusId, setFocusId } = useTvNav({
    rows,
    enabled: !alexaOpen && !mcpOpen,
    onActivate,
    onBack: () => {
      setAlexaOpen(false);
      setMcpOpen(false);
    },
    onAlexa: () => setAlexaOpen(true),
  });

  return (
    <main className="tv-grain min-h-dvh">
      <FamilyBoard focusId={focusId} onFocus={setFocusId} onActivate={onActivate} />
      <TvChrome focusId={focusId} onFocus={setFocusId} onActivate={onActivate} />
      <AlexaOverlay />
      <McpPanel />
    </main>
  );
}
