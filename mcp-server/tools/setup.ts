import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhisperSession } from "../types.ts";
import { connectSession, writeConfig } from "./connect.ts";

export function registerSetupTool(
  server: McpServer,
  session: WhisperSession,
): void {
  server.tool(
    "whisper_setup",
    "Set up a whisper channel with all preferences in one step. Connects to a channel, sets intensity, and saves config for future sessions.",
    {
      gist_url: z.string().optional().describe("Gist URL or ID to join. Omit to create a new channel."),
      intensity: z.enum(["low", "medium", "high"]).default("medium").describe("Context sharing level: low (file paths only), medium (summaries), high (full context)"),
      check_frequency_minutes: z.number().min(1).max(60).default(5).describe("How often to check for peer activity (minutes)"),
      auto_expiration_days: z.number().min(1).max(30).default(7).describe("Auto-expire the periodic check after this many days"),
      notifications: z.enum(["all", "important"]).default("important").describe("all = always report pulse results; important = only report when peer creates new files, broadcasts, or overlaps with your work"),
    },
    async ({ gist_url, intensity, check_frequency_minutes, auto_expiration_days, notifications }) => {
      connectSession(session, gist_url);
      session.intensity = intensity;
      writeConfig(session, { intensity, check_frequency_minutes, auto_expiration_days, notifications });

      const peerInfo = session.peer_session_id
        ? `Peer session: ${session.peer_session_id}`
        : "Waiting for peer to connect";

      const cronExpr = check_frequency_minutes === 1
        ? "* * * * *"
        : `*/${check_frequency_minutes} * * * *`;

      const cronPrompt = notifications === "all"
        ? "Call whisper_pulse. Report all peer activity to the user."
        : "Call whisper_pulse. Only notify the user if the peer created new files (Write tool), sent a broadcast, or there is overlap with your work. Otherwise respond with nothing.";

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Whisper channel configured.`,
              `Channel: ${session.gist_id}`,
              `URL: ${session.gist_url}`,
              `Intensity: ${intensity}`,
              `Notifications: ${notifications}`,
              `Check frequency: every ${check_frequency_minutes} minutes`,
              `Auto-expiration: ${auto_expiration_days} days`,
              peerInfo,
              ``,
              `ACTION REQUIRED: Create a recurring pulse check by calling CronCreate with:`,
              `  cron: "${cronExpr}"`,
              `  prompt: "${cronPrompt}"`,
            ].join("\n"),
          },
        ],
      };
    },
  );
}
