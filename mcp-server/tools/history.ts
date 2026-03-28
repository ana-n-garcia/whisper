import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhisperSession, WhisperEvent } from "../types.ts";
import { readComments } from "../gist.ts";

export function registerHistoryTool(
  server: McpServer,
  session: WhisperSession,
): void {
  server.tool(
    "whisper_history",
    "View recent shared context between sessions.",
    {
      count: z.number().default(10).describe("Number of recent events to show"),
    },
    async ({ count }) => {
      if (!session.gist_id) {
        return {
          content: [
            { type: "text" as const, text: "No whisper session configured. Use /whisper to set up, or call whisper_setup directly." },
          ],
        };
      }

      const { events } = readComments(session.gist_id);
      const recent = events.slice(-count);

      if (recent.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No history yet." },
          ],
        };
      }

      const lines = recent.map((event) => {
        const who = event.session_id === session.session_id ? "You" : "Peer";
        const time = event.timestamp;
        const action =
          event.event_type === "broadcast"
            ? `[broadcast] ${event.summary ?? ""}`
            : `${event.tool_name ?? "action"}: ${event.summary ?? event.file_paths?.join(", ") ?? ""}`;
        return `[${time}] ${who}: ${action}`;
      });

      return {
        content: [
          { type: "text" as const, text: lines.join("\n") },
        ],
      };
    },
  );
}
