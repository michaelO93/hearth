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

## MCP

JSON-RPC 2.0. Start with `initialize`, then `tools/list` and `tools/call`. Protocol header: `MCP-Protocol-Version: 2025-11-25`.

Resources: `hearth://household`, `hearth://people`, `hearth://bills`, `hearth://tonight`.
