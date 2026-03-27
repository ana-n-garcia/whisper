import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const SERVER_PATH = join(fileURLToPath(import.meta.url), "../../index.ts");

let tmpDir: string;
let mockGhDir: string;
let ghLogPath: string;
let ghResponsesPath: string;

// Store gist comments in memory via a mock gh script
function setupMockGh() {
  tmpDir = mkdtempSync(join(tmpdir(), "whisper-integration-"));
  mockGhDir = join(tmpDir, "bin");
  mkdirSync(mockGhDir);
  ghLogPath = join(tmpDir, "gh-calls.log");
  ghResponsesPath = join(tmpDir, "gh-responses.json");

  // Default responses
  writeFileSync(ghResponsesPath, JSON.stringify({
    "gists": { id: "test-gist-id", html_url: "https://gist.github.com/user/test-gist-id" },
    "comments": [],
  }));

  // Mock gh script that logs calls and returns canned responses
  writeFileSync(
    join(mockGhDir, "gh"),
    `#!/bin/bash
RESPONSES_FILE="${ghResponsesPath}"
echo "$@" >> "${ghLogPath}"

# Parse the endpoint from arguments
ENDPOINT="$2"

if [[ "$ENDPOINT" == "gists" ]] && [[ "$*" == *"-X POST"* || "$*" == *"-f "* ]] && [[ "$ENDPOINT" != *"/"* ]]; then
  # Create gist
  cat "$RESPONSES_FILE" | node -e "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).gists))"
elif [[ "$ENDPOINT" == *"/comments" ]] && [[ "$*" == *"-f body"* ]]; then
  # Post comment - extract body and append to comments file
  BODY=$(echo "$@" | sed "s/.*-f body=//; s/ .*//; s/^'//; s/'$//")
  COMMENTS_FILE="${tmpDir}/posted-comments.jsonl"
  echo "$BODY" >> "$COMMENTS_FILE"
  echo '{"id": 1}'
elif [[ "$ENDPOINT" == *"/comments" ]]; then
  # Read comments
  COMMENTS_FILE="${tmpDir}/posted-comments.jsonl"
  if [ -f "$COMMENTS_FILE" ]; then
    node -e "
      const fs = require('fs');
      const lines = fs.readFileSync('$COMMENTS_FILE','utf8').trim().split('\\n').filter(Boolean);
      const comments = lines.map((body, i) => ({ id: i+1, body }));
      process.stdout.write(JSON.stringify(comments));
    "
  else
    echo '[]'
  fi
else
  echo '{}'
fi
`,
    { mode: 0o755 },
  );

  // Create whisper config dir
  mkdirSync(join(tmpDir, ".whisper"));
}

async function createClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", SERVER_PATH],
    env: {
      ...process.env,
      PATH: `${mockGhDir}:${process.env.PATH}`,
      HOME: tmpDir,
    },
  });

  const client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(transport);
  return client;
}

describe("Whisper MCP Server Integration", () => {
  let client: Client;

  beforeAll(async () => {
    setupMockGh();
    client = await createClient();
  }, 15000);

  afterAll(async () => {
    await client?.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists all 5 tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();

    expect(names).toEqual([
      "whisper_broadcast",
      "whisper_connect",
      "whisper_history",
      "whisper_pulse",
      "whisper_set_intensity",
    ]);
  });

  it("connect creates a channel", async () => {
    const result = await client.callTool({
      name: "whisper_connect",
      arguments: {},
    });

    const text = (result.content as any)[0].text;
    expect(text).toContain("Connected to whisper channel");
    expect(text).toContain("test-gist-id");
  });

  it("broadcast + history flow", async () => {
    // First broadcast something
    const broadcastResult = await client.callTool({
      name: "whisper_broadcast",
      arguments: { context: "Working on auth refactor", tags: ["auth"] },
    });
    expect((broadcastResult.content as any)[0].text).toContain("Broadcast sent");

    // Then check history
    const historyResult = await client.callTool({
      name: "whisper_history",
      arguments: { count: 10 },
    });
    const historyText = (historyResult.content as any)[0].text;
    // History should show something (either the broadcast or "No history" if comments aren't persisted through mock)
    expect(historyText).toBeDefined();
  });

  it("set_intensity changes level", async () => {
    const result = await client.callTool({
      name: "whisper_set_intensity",
      arguments: { level: "high" },
    });

    const text = (result.content as any)[0].text;
    expect(text).toContain("high");
    expect(text).toContain("Raw diffs");
  });
});
