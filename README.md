# Hearth

Household steward for multi-generational homes. Alexa+ living-room board plus a self-hosted MCP server (spec `2025-11-25`, Streamable HTTP).

Demo house: the Adeyemis, Surulere, Lagos. Elder check-ins, shared bills in naira, presence, and match night.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:8080`. MCP endpoint: `POST http://localhost:8080/api/mcp`.

Optional: set `XAI_API_KEY` for the Alexa+ agent. Without it, the same tools still run through local intent.

No keys at all? The board, the Ask Hearth overlay and the MCP server all work. Try "Who's home?", "Where is Sade?", "What's left on the light bill?", "Baba is fine", "Put the match on".

## AWS

Code: [`src/lib/hearth/aws.ts`](src/lib/hearth/aws.ts), wired in [`src/lib/hearth/agent.ts`](src/lib/hearth/agent.ts).

| Service | What it does in Hearth | Status |
| --- | --- | --- |
| **Amazon Polly** (`@aws-sdk/client-polly`) | Speaks every Hearth reply in the Alexa overlay. Neural `Ruth` (en-GB), falling back to standard `Joanna`. Returns MP3 as a data URL. | Working |
| **Amazon Bedrock** (`@aws-sdk/client-bedrock-runtime`, Converse API) | Claude Haiku 4.5 runs the household agent with the same 9 Hearth tools the MCP server exposes (`get_people`, `pay_bill`, `record_checkin`, …), up to two tool rounds per turn. | Built; blocked by account (see [FRICTION_LOG.md](FRICTION_LOG.md)) |

Reply order: Bedrock → xAI → local intent. Voice order: Polly → xAI. Account-level denials are cached for the process lifetime, so a blocked service never slows a turn.

```bash
export AWS_PROFILE=your-profile   # or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
export AWS_REGION=us-east-1
# optional
export BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
export POLLY_VOICE_ID=Ruth
export HEARTH_NO_BEDROCK=1        # skip Bedrock entirely
export HEARTH_NO_POLLY=1          # skip Polly entirely
```

IAM needs `polly:SynthesizeSpeech` and `bedrock:InvokeModel`. The overlay header reads "Alexa+ · Bedrock" when Bedrock answers and "Local steward" when the fallback answers.

## MCP

JSON-RPC 2.0. Start with `initialize`, then `tools/list` and `tools/call`. Protocol header: `MCP-Protocol-Version: 2025-11-25`.

Resources: `hearth://household`, `hearth://people`, `hearth://bills`, `hearth://tonight`.
