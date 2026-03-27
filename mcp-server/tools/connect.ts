import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhisperSession } from "../types.ts";
import { createGist, readComments } from "../gist.ts";

const CONFIG_DIR = join(homedir(), ".whisper");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function registerConnectTool(
  server: McpServer,
  session: WhisperSession,
): void {
  server.tool(
    "whisper_connect",
    "Connect to a whisper channel. Pass a gist URL/ID to join, or omit to create a new channel.",
    { gist_url: z.string().optional().describe("Gist URL or ID to join. Omit to create a new channel.") },
    async ({ gist_url }) => {
      if (!gist_url) {
        // Create new channel
        const result = createGist(session.session_id);
        session.gist_id = result.id;
        session.gist_url = result.html_url;
      } else {
        // Join existing channel
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

      // Write config for hook script
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

function writeConfig(session: WhisperSession): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify({
      gist_id: session.gist_id,
      gist_url: session.gist_url,
      session_id: session.session_id,
    }),
  );
}
