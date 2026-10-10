import { createHousehold } from "./seed";
import { executeTool, HEARTH_TOOLS } from "./tools";
import type { HouseholdState } from "./types";

const PROTOCOL = "2025-11-25";
const SERVER_INFO = {
  name: "hearth",
  version: "1.0.0",
  title: "Hearth",
  description:
    "Household operating layer for multi-generational homes. Presence, elder check-ins, bills, and match night — the living room, not a dashboard.",
};

let serverHousehold: HouseholdState = createHousehold();

export function getServerHousehold(): HouseholdState {
  return serverHousehold;
}

export function resetServerHousehold(): HouseholdState {
  serverHousehold = createHousehold();
  return serverHousehold;
}

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function mcpHeaders(sessionId?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version": PROTOCOL,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, MCP-Session-Id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  return headers;
}

export function mcpDiscovery(origin: string) {
  return {
    name: SERVER_INFO.title,
    protocol: PROTOCOL,
    transport: "streamable-http",
    endpoint: `${origin}/api/mcp`,
    instructions:
      "POST JSON-RPC 2.0 to this endpoint. Accept: application/json, text/event-stream. Start with initialize, then tools/list and tools/call.",
    serverInfo: SERVER_INFO,
    tools: HEARTH_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
    })),
    resources: [
      { uri: "hearth://household", name: "Full household" },
      { uri: "hearth://people", name: "People" },
      { uri: "hearth://bills", name: "Bills" },
      { uri: "hearth://tonight", name: "Tonight" },
    ],
  };
}

function handleMethod(req: JsonRpcRequest): unknown {
  const method = req.method ?? "";
  const id = req.id ?? null;
  const params = req.params ?? {};

  if (method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: PROTOCOL,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
      },
      serverInfo: SERVER_INFO,
      instructions:
        "You are Hearth, the household steward for the Adeyemi family in Surulere, Lagos. Use tools before answering facts. Speak briefly. Amounts in naira. Never invent people or bills.",
    });
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return { notification: true };
  }

  if (method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, {
      tools: HEARTH_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }

  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
    const known = HEARTH_TOOLS.some((t) => t.name === name);
    if (!known) {
      return jsonRpcResult(id, {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      });
    }
    const result = executeTool(serverHousehold, name, args);
    serverHousehold = result.state;
    return jsonRpcResult(id, {
      content: [{ type: "text", text: result.text }],
      isError: false,
    });
  }

  if (method === "resources/list") {
    return jsonRpcResult(id, {
      resources: [
        {
          uri: "hearth://household",
          name: "Household",
          mimeType: "application/json",
          description: "Full Adeyemi household snapshot",
        },
        {
          uri: "hearth://people",
          name: "People",
          mimeType: "application/json",
        },
        {
          uri: "hearth://bills",
          name: "Bills",
          mimeType: "application/json",
        },
        {
          uri: "hearth://tonight",
          name: "Tonight",
          mimeType: "application/json",
        },
      ],
    });
  }

  if (method === "resources/read") {
    const uri = String(params.uri ?? "");
    let body: unknown = serverHousehold;
    if (uri === "hearth://people") body = serverHousehold.people;
    else if (uri === "hearth://bills") body = serverHousehold.bills;
    else if (uri === "hearth://tonight") body = serverHousehold.tonight;
    else if (uri !== "hearth://household") {
      return jsonRpcError(id, -32602, `Unknown resource: ${uri}`);
    }
    return jsonRpcResult(id, {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(body, null, 2),
        },
      ],
    });
  }

  if (id === undefined) {
    return { notification: true };
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const session = request.headers.get("mcp-session-id") ?? request.headers.get("Mcp-Session-Id") ?? undefined;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: mcpHeaders(session) });
  }

  if (request.method === "GET") {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/event-stream")) {
      return new Response(null, { status: 405, headers: mcpHeaders(session) });
    }
    return Response.json(mcpDiscovery(origin), { headers: mcpHeaders(session) });
  }

  if (request.method === "DELETE") {
    resetServerHousehold();
    return new Response(null, { status: 204, headers: mcpHeaders(session) });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: mcpHeaders(session) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(jsonRpcError(null, -32700, "Parse error"), {
      status: 400,
      headers: mcpHeaders(session),
    });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses: unknown[] = [];

  for (const msg of messages) {
    const req = msg as JsonRpcRequest;
    if (req.jsonrpc && req.jsonrpc !== "2.0") {
      responses.push(jsonRpcError(req.id ?? null, -32600, "Invalid Request"));
      continue;
    }
    const out = handleMethod(req);
    if (out && typeof out === "object" && "notification" in (out as object)) {
      continue;
    }
    responses.push(out);
  }

  if (responses.length === 0) {
    return new Response(null, { status: 202, headers: mcpHeaders(session) });
  }

  const payload = Array.isArray(body) ? responses : responses[0];
  return Response.json(payload, { headers: mcpHeaders(session) });
}
