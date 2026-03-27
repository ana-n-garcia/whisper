import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import type { WhisperSession } from "./types.ts";
import { registerConnectTool } from "./tools/connect.ts";
import { registerPulseTool } from "./tools/pulse.ts";
import { registerBroadcastTool } from "./tools/broadcast.ts";
import { registerHistoryTool } from "./tools/history.ts";
import { registerSetIntensityTool } from "./tools/set-intensity.ts";

const server = new McpServer({
  name: "whisper",
  version: "0.1.0",
});

const session: WhisperSession = {
  gist_id: "",
  gist_url: "",
  session_id: randomUUID(),
  intensity: "medium",
  local_events: [],
};

registerConnectTool(server, session);
registerPulseTool(server, session);
registerBroadcastTool(server, session);
registerHistoryTool(server, session);
registerSetIntensityTool(server, session);

const transport = new StdioServerTransport();
await server.connect(transport);
