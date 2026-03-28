import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhisperSession, WhisperConfig, Notifications } from "../types.ts";
import { createGist, readComments } from "../gist.ts";

const CONFIG_DIR = join(homedir(), ".whisper");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** Connect session to a channel (create or join). Reusable by setup tool. */
export function connectSession(session: WhisperSession, gist_url?: string): void {
  if (!gist_url) {
    const result = createGist(session.session_id);
    session.gist_id = result.id;
    session.gist_url = result.html_url;
  } else {
    session.gist_id = parseGistId(gist_url);
    session.gist_url = gist_url.startsWith("http")
      ? gist_url
      : `https://gist.github.com/${gist_url}`;

    // Discover peer
    const { events } = readComments(session.gist_id);
    for (const event of events) {
      if (event.session_id !== session.session_id) {
        session.peer_session_id = event.session_id;
        break;
      }
    }
  }
}

/** Write config to ~/.whisper/config.json. Accepts partial overrides for preferences. */
export function writeConfig(session: WhisperSession, preferences?: Partial<Pick<WhisperConfig, "intensity" | "check_frequency_minutes" | "auto_expiration_days" | "notifications">>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const config: WhisperConfig = {
    gist_id: session.gist_id,
    gist_url: session.gist_url,
    session_id: session.session_id,
    intensity: preferences?.intensity ?? session.intensity,
    check_frequency_minutes: preferences?.check_frequency_minutes ?? 5,
    auto_expiration_days: preferences?.auto_expiration_days ?? 7,
    notifications: preferences?.notifications ?? "important",
  };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function registerConnectTool(
  server: McpServer,
  session: WhisperSession,
): void {
  server.tool(
    "whisper_connect",
    "Connect to a whisper channel. Pass a gist URL/ID to join, or omit to create a new channel.",
    { gist_url: z.string().optional().describe("Gist URL or ID to join. Omit to create a new channel.") },
    async ({ gist_url }) => {
      connectSession(session, gist_url);
      writeConfig(session);

      const peerInfo = session.peer_session_id
        ? `Peer session: ${session.peer_session_id}`
        : "Waiting for peer to connect";

      return {
        content: [
          {
            type: "text" as const,
            text: `Connected to whisper channel ${session.gist_id}.\nURL: ${session.gist_url}\n${peerInfo}`,
          },
        ],
      };
    },
  );
}

function parseGistId(urlOrId: string): string {
  // Handle full URL: https://gist.github.com/user/abc123
  const match = urlOrId.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/);
  if (match) return match[1];

  // Handle gist.github.com/abc123
  const match2 = urlOrId.match(/gist\.github\.com\/([a-f0-9]+)/);
  if (match2) return match2[1];

  // Bare ID
  return urlOrId;
}
