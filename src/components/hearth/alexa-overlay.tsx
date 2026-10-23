import { ArrowUp, Mic, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { askHearth, speakHearth } from "@/lib/hearth/agent";
import { localIntent } from "@/lib/hearth/tools";
import { SUGGESTED_ASKS } from "@/lib/hearth/seed";
import { useHearth } from "@/lib/hearth/store";
import { cn } from "@/lib/utils";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function AlexaOverlay() {
  const open = useHearth((s) => s.alexaOpen);
  const setOpen = useHearth((s) => s.setAlexaOpen);
  const turns = useHearth((s) => s.turns);
  const addTurn = useHearth((s) => s.addTurn);
  const setHousehold = useHearth((s) => s.setHousehold);
  const muted = useHearth((s) => s.muted);
  const setMuted = useHearth((s) => s.setMuted);
  const setSpeaking = useHearth((s) => s.setSpeaking);
  const queuedAsk = useHearth((s) => s.queuedAsk);
  const setQueuedAsk = useHearth((s) => s.setQueuedAsk);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"bedrock" | "alexa+" | "local" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!open) stopListening();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !queuedAsk) return;
    const ask = queuedAsk;
    setQueuedAsk(null);
    void send(ask);
    // send is stable enough for demo open-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, queuedAsk]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  // Browser voice as the last resort, so "Voice on" always says something.
  function speakInBrowser(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  async function speak(text: string, force = false) {
    if (muted && !force) return;
    setSpeaking(true);
    try {
      const res = await speakHearth({ data: { text } });
      if (res.ok) {
        audioRef.current?.pause();
        const audio = new Audio(res.audio);
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => speakInBrowser(text);
        await audio.play().catch(() => speakInBrowser(text));
      } else {
        speakInBrowser(text);
      }
    } catch {
      speakInBrowser(text);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function startListening() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      addTurn({ role: "hearth", text: "This browser can't hear me. Open Hearth in Chrome to talk, or type below." });
      return;
    }
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    const rec = new Ctor();
    rec.lang = "en-NG";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setDraft((finalText || interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        addTurn({ role: "hearth", text: "I need microphone access. Allow it in the browser's address bar, then tap the mic again." });
      }
      stopListening();
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (finalText.trim()) void send(finalText);
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function send(text: string) {
    const utterance = text.trim();
    if (!utterance || pending) return;
    setDraft("");
    addTurn({ role: "user", text: utterance });
    setPending(true);
    try {
      const history = useHearth.getState().turns.map((t) => ({ role: t.role, text: t.text }));
      const current = useHearth.getState().household;
      const timeout = new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 14000);
      });
      const res = await Promise.race([
        askHearth({
          data: { utterance, household: current, history },
        }),
        timeout,
      ]);
      if (!res) {
        const local = localIntent(utterance, current);
        setHousehold(local.state);
        setMode("local");
        addTurn({ role: "hearth", text: local.text });
        void speak(local.text);
        return;
      }
      if (!res.ok) {
        addTurn({ role: "hearth", text: res.error });
        return;
      }
      setHousehold(res.household);
      setMode(res.mode);
      addTurn({ role: "hearth", text: res.reply, tools: res.tools });
      void speak(res.reply);
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg/80 backdrop-blur-[2px] sm:justify-end">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close Hearth"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[920px] flex-col bg-surface shadow-border sm:h-[min(72vh,720px)] sm:rounded-t-xl">
        <header className="flex items-center justify-between px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className={cn("orb size-8 rounded-full", pending && "orb-listen")} />
            <div>
              <div className="font-display text-lg tracking-tight">Hearth</div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted">
                {pending ? "Working" : mode === "local" ? "Local steward" : mode === "bedrock" ? "Alexa+ · Bedrock" : "Alexa+"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                audioRef.current?.pause();
                window.speechSynthesis?.cancel();
                setSpeaking(false);
                const next = !muted;
                setMuted(next);
                // Speak right away so the toggle is audible (and unlocks audio on this click).
                if (!next) void speak("Voice on.", true);
              }}
              aria-pressed={!muted}
              className={cn(
                "rounded-md px-3 py-2 text-xs uppercase tracking-[0.14em] hover:text-fg",
                muted ? "text-muted" : "bg-elevated text-fg shadow-border",
              )}
            >
              {muted ? "Voice off" : "Voice on"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-md text-muted hover:text-fg"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-7">
          {turns.length === 0 ? (
            <div className="flex flex-col gap-6 py-6">
              <p className="max-w-md font-display text-2xl font-medium leading-snug tracking-tight text-fg sm:text-3xl">
                The Adeyemi house is listening.
              </p>
              <p className="max-w-md text-sm leading-relaxed text-muted">
                Ask who is home, whether Baba has checked in, what is still open on the bills, or put the match on the
                board.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_ASKS.map((ask) => (
                  <button
                    key={ask}
                    type="button"
                    onClick={() => void send(ask)}
                    className="rounded-md bg-elevated px-3 py-2 text-left text-sm text-fg shadow-border hover:bg-elevated/80"
                  >
                    {ask}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="flex flex-col gap-5 py-4">
              {turns.map((turn, i) => (
                <li key={`${turn.role}-${i}`} className={cn(turn.role === "user" && "text-muted")}>
                  {turn.role === "user" ? (
                    <p className="text-sm">{turn.text}</p>
                  ) : (
                    <div>
                      {turn.tools && turn.tools.length > 0 ? (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {turn.tools.map((tool, ti) => (
                            <span
                              key={`${tool.name}-${ti}`}
                              className="rounded-sm bg-elevated px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-muted"
                            >
                              {tool.summary}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="font-display text-xl font-medium leading-snug tracking-tight sm:text-2xl">
                        {turn.text}
                      </p>
                    </div>
                  )}
                </li>
              ))}
              {pending ? (
                <li className="text-sm text-muted">
                  <span className="inline-block animate-pulse">Looking at the house…</span>
                </li>
              ) : null}
            </ol>
          )}
        </div>

        <form
          className="border-t border-border px-4 py-4 sm:px-7"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <div className="flex items-center gap-2 rounded-md bg-elevated px-3 py-2 shadow-border">
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening())}
              disabled={pending}
              aria-label={listening ? "Stop listening" : "Speak to Hearth"}
              aria-pressed={listening}
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-sm disabled:opacity-40",
                listening ? "animate-pulse bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              <Mic className="size-4" strokeWidth={1.75} />
            </button>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={listening ? "Listening…" : "Ask the house, or tap the mic"}
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="grid size-11 place-items-center rounded-sm bg-accent text-accent-fg disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="size-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
