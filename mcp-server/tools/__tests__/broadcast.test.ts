import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WhisperSession } from "../../types.ts";

vi.mock("../../gist.ts", () => ({
  postComment: vi.fn(),
}));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBroadcastTool } from "../broadcast.ts";
import { postComment } from "../../gist.ts";

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

async function callBroadcast(session: WhisperSession, args: Record<string, unknown>) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  let capturedHandler: any;
  const origTool = server.tool.bind(server);
  server.tool = ((name: string, desc: string, schema: any, handler: any) => {
    capturedHandler = handler;
    return origTool(name, desc, schema, handler);
  }) as any;
  registerBroadcastTool(server, session);
  return capturedHandler!(args);
}

describe("whisper_broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts broadcast event with context and tags", async () => {
    const session = makeSession();
    const result = await callBroadcast(session, {
      context: "Working on auth refactor",
      tags: ["auth", "refactor"],
    });

    expect(postComment).toHaveBeenCalledWith("gist123", expect.objectContaining({
      event_type: "broadcast",
      summary: "Working on auth refactor",
      keywords: ["auth", "refactor"],
    }));
    expect(result.content[0].text).toContain("Broadcast sent");
    expect(result.content[0].text).toContain("Working on auth refactor");
  });

  it("requires connection", async () => {
    const session = makeSession({ gist_id: "" });
    const result = await callBroadcast(session, { context: "hello" });

    expect(result.content[0].text).toContain("No whisper session configured");
    expect(postComment).not.toHaveBeenCalled();
  });

  it("works without tags", async () => {
    const session = makeSession();
    const result = await callBroadcast(session, { context: "just a note" });

    expect(postComment).toHaveBeenCalled();
    expect(result.content[0].text).toContain("just a note");
  });
});
