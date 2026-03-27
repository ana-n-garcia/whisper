import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WhisperSession } from "../../types.ts";

vi.mock("../../gist.ts", () => ({
  readComments: vi.fn(),
}));

vi.mock("../../matcher.ts", () => ({
  detectOverlap: vi.fn().mockReturnValue({
    has_overlap: false,
    file_overlaps: [],
    search_overlaps: [],
    summary: "",
  }),
}));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPulseTool } from "../pulse.ts";
import { readComments } from "../../gist.ts";
import { detectOverlap } from "../../matcher.ts";

function makeSession(overrides: Partial<WhisperSession> = {}): WhisperSession {
  return {
    gist_id: "gist123",
    gist_url: "https://gist.github.com/user/gist123",
    session_id: "my-session",
    intensity: "medium",
    local_events: [],
    ...overrides,
  };
}

async function callPulse(session: WhisperSession) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  let capturedHandler: any;
  const origTool = server.tool.bind(server);
  server.tool = ((name: string, desc: string, schema: any, handler: any) => {
    capturedHandler = handler;
    return origTool(name, desc, schema, handler);
  }) as any;
  registerPulseTool(server, session);
  return capturedHandler!({});
}

describe("whisper_pulse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not connected when no gist_id", async () => {
    const session = makeSession({ gist_id: "" });
    const result = await callPulse(session);

    expect(result.content[0].text).toContain("Not connected");
  });

  it("returns peer events", async () => {
    vi.mocked(readComments).mockReturnValue({
      events: [
        { session_id: "peer", timestamp: "t1", event_type: "tool_use", tool_name: "Edit", summary: "Edited src/auth.ts" },
        { session_id: "peer", timestamp: "t2", event_type: "tool_use", tool_name: "Grep", summary: "Searched for 'token'" },
        { session_id: "peer", timestamp: "t3", event_type: "broadcast", summary: "Working on auth" },
      ],
      lastId: 3,
    });

    const session = makeSession();
    const result = await callPulse(session);

    expect(result.content[0].text).toContain("3 new events");
    expect(result.content[0].text).toContain("Edited src/auth.ts");
  });

  it("updates last_comment_id", async () => {
    vi.mocked(readComments).mockReturnValue({
      events: [
        { session_id: "peer", timestamp: "t1", event_type: "tool_use" },
      ],
      lastId: 42,
    });

    const session = makeSession();
    await callPulse(session);

    expect(session.last_comment_id).toBe(42);
  });

  it("includes overlap info when detected", async () => {
    vi.mocked(readComments).mockReturnValue({
      events: [
        { session_id: "peer", timestamp: "t1", event_type: "tool_use", file_paths: ["src/auth.ts"] },
      ],
      lastId: 1,
    });
    vi.mocked(detectOverlap).mockReturnValue({
      has_overlap: true,
      file_overlaps: ["src/auth.ts"],
      search_overlaps: [],
      summary: "Both sessions are working on src/auth.ts.",
    });

    const session = makeSession({
      local_events: [{ session_id: "my-session", timestamp: "t0", event_type: "tool_use", file_paths: ["src/auth.ts"] }],
    });
    const result = await callPulse(session);

    expect(result.content[0].text).toContain("OVERLAP");
    expect(result.content[0].text).toContain("src/auth.ts");
  });

  it("returns no activity message when no peer comments", async () => {
    vi.mocked(readComments).mockReturnValue({
      events: [
        // Only own events
        { session_id: "my-session", timestamp: "t1", event_type: "tool_use" },
      ],
      lastId: 1,
    });

    const session = makeSession();
    const result = await callPulse(session);

    expect(result.content[0].text).toContain("No new activity");
  });
});
