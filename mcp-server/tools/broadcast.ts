import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhisperSession } from "../types.ts";
import { postComment } from "../gist.ts";

export function registerBroadcastTool(
  server: McpServer,
  session: WhisperSession,
): void {
  server.tool(
    "whisper_broadcast",
    "Explicitly share context with your peer.",
    {
      context: z.string().describe("What you want to share with your peer"),
      tags: z.array(z.string()).optional().describe("Optional topic tags"),
    },
    async ({ context, tags }) => {
      if (!session.gist_id) {
        return {
          content: [
            { type: "text" as const, text: "Not connected. Use whisper_connect first." },
          ],
        };
      }

      const event = {
        session_id: session.session_id,
        timestamp: new Date().toISOString(),
        event_type: "broadcast" as const,
        summary: context,
        keywords: tags,
      };

      postComment(session.gist_id, event);

      return {
        content: [
          {
            type: "text" as const,
            text: `Broadcast sent: "${context}"${tags ? ` [${tags.join(", ")}]` : ""}`,
          },
        ],
      };
    },
  );
}
