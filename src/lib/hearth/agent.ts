import { createServerFn } from "@tanstack/react-start";
import type { HouseholdState } from "./types";
import { executeTool, localIntent, toOpenAiTools, toolSummary } from "./tools";
import { bedrockAsk, pollySpeak } from "./aws";
import { forSpeech } from "./format";

const SYSTEM = `You are Hearth, the household steward for the Adeyemi family in Surulere, Lagos.
You run on Alexa+ in the living room, with a Fire TV family board behind you.

Voice: calm, specific, short. Warm Nigerian English — natural, never cartoon pidgin, never colonial stiffness.
Use tools before answering any fact about who is home, bills, check-ins, or tonight.
Amounts in naira. Never invent people, bills, or numbers.
If something is overdue (Baba's check-in, an unpaid bill), say so plainly and offer one next step.
After a mutation, confirm what changed on the board in one or two sentences.
Do not mention tools, JSON, or that you are an AI.`;

type ChatMsg = { role: "user" | "hearth" | "system"; text: string };

type GrokMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AskHearthResult =
  | {
      ok: true;
      reply: string;
      household: HouseholdState;
      tools: { name: string; summary: string }[];
      mode: "bedrock" | "alexa+" | "local";
    }
  | { ok: false; error: string; household: HouseholdState };

export const askHearth = createServerFn({ method: "POST" })
  .validator((input: { utterance: string; household: HouseholdState; history: ChatMsg[] }) => input)
  .handler(async ({ data }): Promise<AskHearthResult> => {
    const utterance = data.utterance.trim().slice(0, 500);
    if (!utterance) {
      return { ok: false, error: "Say something first.", household: data.household };
    }

    const apiKey = process.env.XAI_API_KEY;
    // AWS Builder path first: Bedrock (Claude) with Hearth tools. Falls
    // through to xAI, then local intent — the board always answers.
    const bedrock = await bedrockAsk(utterance, data.household, data.history);
    if (bedrock.ok) {
      return {
        ok: true,
        reply: bedrock.reply,
        household: bedrock.household,
        tools: bedrock.tools,
        mode: "bedrock",
      };
    }

    if (!apiKey) {
      const local = localIntent(utterance, data.household);
      return {
        ok: true,
        reply: local.text,
        household: local.state,
        tools: [],
        mode: "local",
      };
    }

    let household = data.household;
    const toolsUsed: { name: string; summary: string }[] = [];
    const history = data.history.slice(-6);

    const messages: GrokMessage[] = [
      { role: "system", content: SYSTEM },
      ...history.map((h) => ({
        role: (h.role === "hearth" ? "assistant" : "user") as "assistant" | "user",
        content: h.text,
      })),
      { role: "user", content: utterance },
    ];

    try {
      for (let round = 0; round < 2; round++) {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-4.5",
            messages,
            tools: toOpenAiTools(),
            tool_choice: "auto",
            max_tokens: 400,
            temperature: 0.4,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (!res.ok) {
          if (round === 0) {
            const local = localIntent(utterance, household);
            return {
              ok: true,
              reply: local.text,
              household: local.state,
              tools: [],
              mode: "local",
            };
          }
          return {
            ok: false,
            error: `Alexa+ is quiet right now (${res.status}).`,
            household,
          };
        }

        const body = (await res.json()) as {
          choices: {
            message: {
              role: string;
              content?: string | null;
              tool_calls?: ToolCall[];
            };
          }[];
        };
        const message = body.choices[0]?.message;
        if (!message) {
          return { ok: false, error: "No reply from Alexa+.", household };
        }

        const calls = message.tool_calls ?? [];
        if (calls.length === 0) {
          const reply = (message.content ?? "").trim() || "Done.";
          return { ok: true, reply, household, tools: toolsUsed, mode: "alexa+" };
        }

        messages.push({
          role: "assistant",
          content: message.content ?? null,
          tool_calls: calls,
        });

        for (const call of calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            args = {};
          }
          const result = executeTool(household, call.function.name, args);
          household = result.state;
          toolsUsed.push({
            name: call.function.name,
            summary: toolSummary(call.function.name),
          });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: result.text,
          });
        }
      }

      return {
        ok: true,
        reply: "The board is updated.",
        household,
        tools: toolsUsed,
        mode: "alexa+",
      };
    } catch {
      const local = localIntent(utterance, data.household);
      return {
        ok: true,
        reply: local.text,
        household: local.state,
        tools: [],
        mode: "local",
      };
    }
  });

export const speakHearth = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }) => {
    // AWS Builder path first: Polly voice for the Alexa overlay.
    const spoken = forSpeech(data.text);
    const polly = await pollySpeak(spoken);
    if (polly.ok) return { ok: true as const, audio: polly.audio };

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Voice is unavailable." };
    const text = spoken.slice(0, 400);
    if (!text) return { ok: false as const, error: "Nothing to say." };

    try {
      const res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ text, voice_id: "eve" }),
      });
      if (!res.ok) return { ok: false as const, error: `Voice error ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      return { ok: true as const, audio: `data:audio/mpeg;base64,${buf.toString("base64")}` };
    } catch {
      return { ok: false as const, error: "Voice failed." };
    }
  });
