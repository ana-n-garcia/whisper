import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGist, postComment, readComments } from "../gist.ts";
import type { WhisperEvent } from "../types.ts";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createGist", () => {
  it("returns id and url from gh response", () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({ id: "abc123", html_url: "https://gist.github.com/user/abc123" }),
    );

    const result = createGist("session-1");

    expect(result).toEqual({ id: "abc123", html_url: "https://gist.github.com/user/abc123" });
    const cmd = mockExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain("gh api gists");
    expect(cmd).toContain("public=false");
  });

  it("throws on gh CLI error", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("gh: not found");
    });

    expect(() => createGist("session-1")).toThrow("gh: not found");
  });
});

describe("postComment", () => {
  it("sends correct JSON body", () => {
    mockExecSync.mockReturnValue("{}");

    const event: WhisperEvent = {
      session_id: "s1",
      timestamp: "2025-01-01T00:00:00Z",
      event_type: "tool_use",
      tool_name: "Edit",
      file_paths: ["src/auth.ts"],
    };

    postComment("gist123", event);

    const cmd = mockExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain("gists/gist123/comments");
    expect(cmd).toContain("src/auth.ts");
  });

  it("escapes single quotes in JSON body", () => {
    mockExecSync.mockReturnValue("{}");

    const event: WhisperEvent = {
      session_id: "s1",
      timestamp: "2025-01-01T00:00:00Z",
      event_type: "broadcast",
      summary: "it's working",
    };

    postComment("gist123", event);

    const cmd = mockExecSync.mock.calls[0][0] as string;
    expect(cmd).toContain("it'\\''s working");
  });
});

describe("readComments", () => {
  it("parses comment bodies into WhisperEvents", () => {
    const comments = [
      { id: 1, body: JSON.stringify({ session_id: "s1", timestamp: "t1", event_type: "tool_use", tool_name: "Edit" }) },
      { id: 2, body: JSON.stringify({ session_id: "s2", timestamp: "t2", event_type: "broadcast", summary: "hello" }) },
    ];
    mockExecSync.mockReturnValue(JSON.stringify(comments));

    const result = readComments("gist123");

    expect(result.events).toHaveLength(2);
    expect(result.events[0].session_id).toBe("s1");
    expect(result.events[1].event_type).toBe("broadcast");
  });

  it("filters by sinceId", () => {
    const comments = [
      { id: 1, body: JSON.stringify({ session_id: "s1", timestamp: "t1", event_type: "tool_use" }) },
      { id: 2, body: JSON.stringify({ session_id: "s1", timestamp: "t2", event_type: "tool_use" }) },
      { id: 3, body: JSON.stringify({ session_id: "s1", timestamp: "t3", event_type: "tool_use" }) },
    ];
    mockExecSync.mockReturnValue(JSON.stringify(comments));

    const result = readComments("gist123", 1);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].timestamp).toBe("t2");
  });

  it("returns updated lastId", () => {
    const comments = [
      { id: 5, body: JSON.stringify({ session_id: "s1", timestamp: "t1", event_type: "tool_use" }) },
      { id: 10, body: JSON.stringify({ session_id: "s1", timestamp: "t2", event_type: "tool_use" }) },
      { id: 7, body: JSON.stringify({ session_id: "s1", timestamp: "t3", event_type: "tool_use" }) },
    ];
    mockExecSync.mockReturnValue(JSON.stringify(comments));

    const result = readComments("gist123");

    expect(result.lastId).toBe(10);
  });

  it("handles empty response", () => {
    mockExecSync.mockReturnValue("[]");

    const result = readComments("gist123");

    expect(result.events).toHaveLength(0);
    expect(result.lastId).toBeUndefined();
  });

  it("skips malformed comment bodies", () => {
    const comments = [
      { id: 1, body: "not json" },
      { id: 2, body: JSON.stringify({ session_id: "s1", timestamp: "t1", event_type: "tool_use" }) },
    ];
    mockExecSync.mockReturnValue(JSON.stringify(comments));

    const result = readComments("gist123");

    expect(result.events).toHaveLength(1);
    expect(result.lastId).toBe(2);
  });
});
