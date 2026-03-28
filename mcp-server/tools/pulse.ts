import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WhisperSession, WhisperEvent, Intensity } from "../types.ts";
import { readComments } from "../gist.ts";
import { detectOverlap } from "../matcher.ts";
import { summarize } from "../summarizer.ts";

export function registerPulseTool(
  server: McpServer,
  session: WhisperSession,
): void {
  server.tool(
    "whisper_pulse",
    "Check what your peer is thinking about. Returns recent peer activity and any overlaps with your work.",
    {},
    async () => {
      if (!session.gist_id) {
        return {
          content: [
            { type: "text" as const, text: "No whisper session configured. Use /whisper to set up, or call whisper_setup directly." },
          ],
        };
      }

      const { events: allEvents, lastId } = readComments(
        session.gist_id,
        session.last_comment_id,
      );

      if (lastId !== undefined) {
        session.last_comment_id = lastId;
      }

      // Filter to peer events only
      const peerEvents = allEvents.filter(
        (e) => e.session_id !== session.session_id,
      );

      if (peerEvents.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No new activity from peer." },
          ],
        };
      }

      // Discover peer if not yet known
      if (!session.peer_session_id && peerEvents.length > 0) {
        session.peer_session_id = peerEvents[0].session_id;
      }

      // Enrich events through summarizer at current intensity
      const enrichedEvents = peerEvents.map((e) => {
        if (e.event_type === "broadcast" || !e.tool_name) return e;
        if (!e.raw_input) return e;
        return summarize(
          {
            session_id: e.session_id,
            tool_name: e.tool_name,
            tool_input: e.raw_input as Record<string, unknown>,
          },
          session.intensity,
        );
      });

      // Format peer activity
      const lines = formatPeerEvents(enrichedEvents, session.intensity);

      // Check for overlap
      const overlap = detectOverlap(session.local_events, peerEvents);
      if (overlap.has_overlap) {
        lines.push("");
        lines.push(`OVERLAP: ${overlap.summary}`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );
}

function formatPeerEvents(
  events: WhisperEvent[],
  intensity: string,
): string[] {
  const lines: string[] = [`Peer activity (${events.length} new events):`];

  for (const event of events) {
    if (event.event_type === "broadcast") {
      lines.push(`  [broadcast] ${event.summary ?? ""}`);
    } else if (intensity === "low") {
      const files = event.file_paths?.join(", ") ?? "";
      const kw = event.keywords?.join(", ") ?? "";
      lines.push(`  ${event.tool_name ?? "action"}: ${files}${kw ? ` (${kw})` : ""}`);
    } else if (intensity === "medium") {
      lines.push(`  ${event.summary ?? event.tool_name ?? "action"}`);
    } else {
      // high
      lines.push(`  ${event.summary ?? event.tool_name ?? "action"}`);
      if (event.raw_input) {
        lines.push(`    raw: ${JSON.stringify(event.raw_input)}`);
      }
    }
  }

  return lines;
}
