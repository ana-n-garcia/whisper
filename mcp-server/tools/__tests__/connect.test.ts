import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WhisperSession } from "../../types.ts";

vi.mock("../../gist.ts", () => ({
  createGist: vi.fn().mockReturnValue({ id: "new-gist-id", html_url: "https://gist.github.com/user/new-gist-id" }),
  readComments: vi.fn().mockReturnValue({ events: [], lastId: undefined }),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerConnectTool } from "../connect.ts";
import { createGist, readComments } from "../../gist.ts";
import { writeFileSync } from "node:fs";

function makeSession(): WhisperSession {
  return {
    gist_id: "",
    gist_url: "",
    session_id: "my-session",
    intensity: "medium",
    local_events: [],
  };
}

// Helper to call the tool directly by capturing the handler
async function callTool(session: WhisperSession, args: Record<string, unknown>) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  let capturedHandler: any;
  const origTool = server.tool.bind(server);
  server.tool = ((name: string, desc: string, schema: any, handler: any) => {
    capturedHandler = handler;
    return origTool(name, desc, schema, handler);
  }) as any;
  registerConnectTool(server, session);
  return capturedHandler!(args);
}

describe("whisper_connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new gist when no gist_url provided", async () => {
    const session = makeSession();
    const result = await callTool(session, {});

    expect(createGist).toHaveBeenCalledWith("my-session");
    expect(session.gist_id).toBe("new-gist-id");
    expect(session.gist_url).toBe("https://gist.github.com/user/new-gist-id");
    expect(result.content[0].text).toContain("new-gist-id");
  });

  it("parses gist ID from full URL", async () => {
    const session = makeSession();
    await callTool(session, { gist_url: "https://gist.github.com/user/abc123def456" });

    expect(session.gist_id).toBe("abc123def456");
  });

  it("accepts bare gist ID", async () => {
    const session = makeSession();
    await callTool(session, { gist_url: "abc123" });

    expect(session.gist_id).toBe("abc123");
  });

  it("writes config file", async () => {
    const session = makeSession();
    await callTool(session, {});

    expect(writeFileSync).toHaveBeenCalled();
    const configContent = JSON.parse((writeFileSync as any).mock.calls[0][1]);
    expect(configContent.gist_id).toBe("new-gist-id");
    expect(configContent.session_id).toBe("my-session");
  });

  it("discovers peer from existing comments", async () => {
    vi.mocked(readComments).mockReturnValue({
      events: [
        { session_id: "peer-session", timestamp: "t1", event_type: "tool_use" },
      ],
      lastId: 1,
    });

    const session = makeSession();
    await callTool(session, { gist_url: "abc123" });

    expect(session.peer_session_id).toBe("peer-session");
    expect(vi.mocked(readComments).mock.results[0]).toBeDefined();
  });
});
