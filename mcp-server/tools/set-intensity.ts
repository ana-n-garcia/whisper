import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhisperSession } from "../types.ts";

const INTENSITY_DESCRIPTIONS = {
  low: "File paths touched and topic keywords only — ambient awareness",
  medium: "Summaries of actions and reasoning — like working in the same room",
  high: "Raw diffs and full conversation context — finishing each other's sentences",
} as const;

export function registerSetIntensityTool(
  server: McpServer,
  session: WhisperSession,
): void {
  server.tool(
    "whisper_set_intensity",
    "Control how much context flows between sessions.",
    {
      level: z.enum(["low", "medium", "high"]).describe("Intensity level"),
    },
    async ({ level }) => {
      session.intensity = level;

      return {
        content: [
          {
            type: "text" as const,
            text: `Intensity set to ${level}. ${INTENSITY_DESCRIPTIONS[level]}.`,
          },
        ],
      };
    },
  );
}
