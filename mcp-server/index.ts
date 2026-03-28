import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { WhisperSession, WhisperConfig } from "./types.ts";
import { registerConnectTool } from "./tools/connect.ts";
import { registerPulseTool } from "./tools/pulse.ts";
import { registerBroadcastTool } from "./tools/broadcast.ts";
import { registerHistoryTool } from "./tools/history.ts";
import { registerSetIntensityTool } from "./tools/set-intensity.ts";
import { registerSetupTool } from "./tools/setup.ts";

function loadConfig(): Partial<WhisperConfig> {
  try {
    const raw = readFileSync(join(homedir(), ".whisper", "config.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const config = loadConfig();

const server = new McpServer({
  name: "whisper",
  version: "0.1.0",
});

const session: WhisperSession = {
  gist_id: config.gist_id ?? "",
  gist_url: config.gist_url ?? "",
  session_id: config.session_id ?? randomUUID(),
  intensity: config.intensity ?? "medium",
  local_events: [],
};

registerConnectTool(server, session);
registerPulseTool(server, session);
registerBroadcastTool(server, session);
registerHistoryTool(server, session);
registerSetIntensityTool(server, session);
registerSetupTool(server, session);

const transport = new StdioServerTransport();
await server.connect(transport);
