import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WhisperSession, WhisperEvent } from "../../types.ts";

vi.mock("../../gist.ts", () => ({
  readComments: vi.fn(),
}));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHistoryTool } from "../history.ts";
import { readComments } from "../../gist.ts";

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

async function callHistory(session: WhisperSession, args: Record<string, unknown>) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  let capturedHandler: any;
  const origTool = server.tool.bind(server);
  server.tool = ((name: string, desc: string, schema: any, handler: any) => {
    capturedHandler = handler;
    return origTool(name, desc, schema, handler);
  }) as any;
  registerHistoryTool(server, session);
  return capturedHandler!(args);
}

function makeEvents(n: number): WhisperEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    session_id: i % 2 === 0 ? "my-session" : "peer-session",
    timestamp: `2025-01-01T00:0${i}:00Z`,
    event_type: "tool_use" as const,
    tool_name: "Edit",
    summary: `Action ${i}`,
  }));
}

describe("whisper_history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns last N events", async () => {
    vi.mocked(readComments).mockReturnValue({ events: makeEvents(20), lastId: 20 });

    const session = makeSession();
    const result = await callHistory(session, { count: 5 });

    const lines = result.content[0].text.split("\n");
    expect(lines).toHaveLength(5);
  });

  it("labels own vs peer events", async () => {
    vi.mocked(readComments).mockReturnValue({
      events: [
        { session_id: "my-session", timestamp: "t1", event_type: "tool_use", tool_name: "Edit", summary: "Edited a.ts" },
        { session_id: "peer-session", timestamp: "t2", event_type: "tool_use", tool_name: "Read", summary: "Read b.ts" },
      ],
      lastId: 2,
    });

    const session = makeSession();
    const result = await callHistory(session, { count: 10 });

    expect(result.content[0].text).toContain("You:");
    expect(result.content[0].text).toContain("Peer:");
  });

  it("defaults to 10", async () => {
    vi.mocked(readComments).mockReturnValue({ events: makeEvents(20), lastId: 20 });

    const session = makeSession();
    const result = await callHistory(session, { count: 10 });

    const lines = result.content[0].text.split("\n");
    expect(lines).toHaveLength(10);
  });

  it("returns no history message when empty", async () => {
    vi.mocked(readComments).mockReturnValue({ events: [], lastId: undefined });

    const session = makeSession();
    const result = await callHistory(session, { count: 10 });

    expect(result.content[0].text).toContain("No history yet");
  });

  it("requires connection", async () => {
    const session = makeSession({ gist_id: "" });
    const result = await callHistory(session, { count: 10 });

    expect(result.content[0].text).toContain("Not connected");
  });
});
