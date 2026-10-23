import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { executeTool, HEARTH_TOOLS, toolSummary } from "./tools";
import type { HouseholdState } from "./types";

const SYSTEM = `You are Hearth, the household steward for the Adeyemi family in Surulere, Lagos.
You run on Alexa+ in the living room, with a Fire TV family board behind you.

Voice: calm, specific, short. Warm Nigerian English — natural, never cartoon pidgin, never colonial stiffness.
Use tools before answering any fact about who is home, bills, check-ins, or tonight.
Amounts in naira. Never invent people, bills, or numbers.
If something is overdue (Baba's check-in, an unpaid bill), say so plainly and offer one next step.
After a mutation, confirm what changed on the board in one or two sentences.
Do not mention tools, JSON, or that you are an AI.`;

export function awsRegion(): string {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

export function bedrockModelId(): string {
  return process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";
}

// Cache a hard "no" for the process lifetime so a misconfigured IAM user
// doesn't add a failed Bedrock round-trip to every single turn.
let bedrockUsable: boolean | undefined;

export function isBedrockDisabled(): boolean {
  return process.env.HEARTH_NO_BEDROCK === "1";
}

type BedrockMsg = {
  role: "user" | "assistant";
  content: unknown[];
};

function toBedrockTools() {
  return HEARTH_TOOLS.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: { json: t.inputSchema as unknown as Record<string, unknown> },
    },
  }));
}

export type BedrockAskResult = {
  ok: true;
  reply: string;
  household: HouseholdState;
  tools: { name: string; summary: string }[];
} | { ok: false; error: string; household: HouseholdState; retryable: boolean };

export async function bedrockAsk(
  utterance: string,
  household: HouseholdState,
  history: { role: string; text: string }[],
): Promise<BedrockAskResult> {
  if (isBedrockDisabled() || bedrockUsable === false) {
    return { ok: false, error: "bedrock-disabled", household, retryable: false };
  }
  const client = new BedrockRuntimeClient({ region: awsRegion() });
  let current = household;
  const toolsUsed: { name: string; summary: string }[] = [];

  const messages: BedrockMsg[] = [
    ...history.slice(-6).map((h) => ({
      role: "user" as const,
      content: [{ text: `${h.role === "hearth" ? "Hearth" : "Family"}: ${h.text}` }],
    })),
    { role: "user" as const, content: [{ text: utterance }] },
  ];

  try {
    for (let round = 0; round < 2; round++) {
      const res = await client.send(
        new ConverseCommand({
          modelId: bedrockModelId(),
          system: [{ text: SYSTEM }],
          messages: messages as never,
          toolConfig: { tools: toBedrockTools() as never },
          inferenceConfig: { maxTokens: 400, temperature: 0.4 },
        }),
      );

      const out = res.output as
        | { message?: { role?: string; content?: { text?: string; toolUse?: { toolUseId: string; name: string; input: unknown } }[] } }
        | undefined;
      const blocks = out?.message?.content ?? [];
      const toolUses = blocks.filter((b) => b.toolUse).map((b) => b.toolUse!);

      if (toolUses.length === 0) {
        const reply = blocks.map((b) => b.text ?? "").join("").trim() || "Done.";
        bedrockUsable = true;
        return { ok: true, reply, household: current, tools: toolsUsed };
      }

      messages.push({
        role: "assistant",
        content: blocks.map((b) =>
          b.toolUse
            ? { toolUse: { toolUseId: b.toolUse.toolUseId, name: b.toolUse.name, input: b.toolUse.input ?? {} } }
            : { text: b.text ?? "" },
        ),
      });

      const followUp: unknown[] = [];
      for (const tu of toolUses) {
        const args = (tu.input ?? {}) as Record<string, unknown>;
        const result = executeTool(current, tu.name, args);
        current = result.state;
        toolsUsed.push({ name: tu.name, summary: toolSummary(tu.name) });
        followUp.push({ toolResult: { toolUseId: tu.toolUseId, content: { text: result.text } } });
      }
      messages.push({ role: "user", content: followUp });
    }

    bedrockUsable = true;
    return { ok: true, reply: "The board is updated.", household: current, tools: toolsUsed };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // "Access to Bedrock models is not allowed for this account" and missing
    // credentials are permanent — stop paying a round-trip on every turn.
    const permanent = /AccessDenied|Unauthorized|not allowed for this account|CredentialsProvider|Could not load credentials/i;
    const retryable = !permanent.test(msg) && !/ValidationException.*model|ResourceNotFound/i.test(msg);
    if (permanent.test(msg)) bedrockUsable = false;
    return { ok: false, error: msg.slice(0, 300), household, retryable };
  }
}

let pollyUsable: boolean | undefined;

export function isPollyDisabled(): boolean {
  return process.env.HEARTH_NO_POLLY === "1";
}

export async function pollySpeak(text: string): Promise<{ ok: true; audio: string } | { ok: false; error: string }> {
  if (isPollyDisabled() || pollyUsable === false) {
    return { ok: false, error: "polly-disabled" };
  }
  const clean = text.trim().slice(0, 400);
  if (!clean) return { ok: false, error: "Nothing to say." };

  const voice = process.env.POLLY_VOICE_ID || "Ruth";
  const client = new PollyClient({ region: awsRegion() });
  const attempts: { Engine: "neural" | "standard"; VoiceId: string; LanguageCode: string }[] = [
    { Engine: "neural", VoiceId: voice, LanguageCode: "en-GB" },
    { Engine: "standard", VoiceId: "Joanna", LanguageCode: "en-US" },
  ];

  for (const a of attempts) {
    try {
      const res = await client.send(
        new SynthesizeSpeechCommand({
          Engine: a.Engine,
          VoiceId: a.VoiceId as never,
          LanguageCode: a.LanguageCode as never,
          OutputFormat: "mp3",
          Text: clean,
          TextType: "text",
        }),
      );
      const bytes = await res.AudioStream?.transformToByteArray();
      if (!bytes?.length) continue;
      pollyUsable = true;
      return { ok: true, audio: `data:audio/mpeg;base64,${Buffer.from(bytes).toString("base64")}` };
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (/AccessDenied|Unauthorized/i.test(msg)) {
        pollyUsable = false;
        return { ok: false, error: msg.slice(0, 200) };
      }
      // Try the next voice/engine fallback before giving up.
    }
  }
  return { ok: false, error: "Polly synthesis failed." };
}
