import { describe, it, expect } from "vitest";
import type { WhisperSession } from "../../types.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSetIntensityTool } from "../set-intensity.ts";

function makeSession(): WhisperSession {
  return {
    gist_id: "gist123",
    gist_url: "https://gist.github.com/user/gist123",
    session_id: "my-session",
    intensity: "medium",
    local_events: [],
  };
}

async function callSetIntensity(session: WhisperSession, args: Record<string, unknown>) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  let capturedHandler: any;
  const origTool = server.tool.bind(server);
  server.tool = ((name: string, desc: string, schema: any, handler: any) => {
    capturedHandler = handler;
    return origTool(name, desc, schema, handler);
  }) as any;
  registerSetIntensityTool(server, session);
  return capturedHandler!(args);
}

describe("whisper_set_intensity", () => {
  it("updates session intensity to high", async () => {
    const session = makeSession();
    const result = await callSetIntensity(session, { level: "high" });

    expect(session.intensity).toBe("high");
    expect(result.content[0].text).toContain("high");
    expect(result.content[0].text).toContain("Raw diffs");
  });

  it("updates session intensity to low", async () => {
    const session = makeSession();
    const result = await callSetIntensity(session, { level: "low" });

    expect(session.intensity).toBe("low");
    expect(result.content[0].text).toContain("low");
    expect(result.content[0].text).toContain("ambient");
  });

  it("returns description for medium", async () => {
    const session = makeSession();
    session.intensity = "low";
    const result = await callSetIntensity(session, { level: "medium" });

    expect(session.intensity).toBe("medium");
    expect(result.content[0].text).toContain("same room");
  });
});
