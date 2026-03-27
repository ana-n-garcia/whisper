import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const EMIT_PATH = join(import.meta.dirname, "../../hooks/emit.js");

function runEmit(
  stdinData: string,
  env: Record<string, string> = {},
): Promise<{ exitCode: number; ghCalls: string[] }> {
  return new Promise((resolve) => {
    const child = spawn("node", [EMIT_PATH], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.write(stdinData);
    child.stdin.end();

    child.on("close", (exitCode) => {
      // Read gh calls logged by mock
      const logPath = env.__GH_LOG_PATH;
      let ghCalls: string[] = [];
      if (logPath) {
        try {
          ghCalls = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean);
        } catch { /* no calls made */ }
      }
      resolve({ exitCode: exitCode ?? 1, ghCalls });
    });
  });
}

describe("emit.js", () => {
  let tmpDir: string;
  let mockGhDir: string;
  let ghLogPath: string;
  let whisperDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "whisper-test-"));
    ghLogPath = join(tmpDir, "gh-calls.log");

    // Create mock gh script
    mockGhDir = join(tmpDir, "bin");
    mkdirSync(mockGhDir);
    writeFileSync(
      join(mockGhDir, "gh"),
      `#!/bin/bash\necho "$@" >> "${ghLogPath}"\n`,
      { mode: 0o755 },
    );

    // Create whisper config dir
    whisperDir = join(tmpDir, ".whisper");
    mkdirSync(whisperDir);
    configPath = join(whisperDir, "config.json");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeEnv(): Record<string, string> {
    return {
      HOME: tmpDir,
      PATH: `${mockGhDir}:${process.env.PATH}`,
      __GH_LOG_PATH: ghLogPath,
    };
  }

  const baseEvent = JSON.stringify({
    session_id: "test-session",
    tool_name: "Edit",
    tool_input: { file_path: "src/auth.ts", old_string: "a", new_string: "b" },
  });

  it("posts event to gist on valid input", async () => {
    writeFileSync(configPath, JSON.stringify({ gist_id: "abc123" }));

    const result = await runEmit(baseEvent, makeEnv());

    expect(result.exitCode).toBe(0);
    expect(result.ghCalls).toHaveLength(1);
    expect(result.ghCalls[0]).toContain("gists/abc123/comments");
  });

  it("exits 0 when no config file", async () => {
    // Don't write config
    const env = makeEnv();

    const result = await runEmit(baseEvent, env);

    expect(result.exitCode).toBe(0);
    expect(result.ghCalls).toHaveLength(0);
  });

  it("exits 0 on gh error", async () => {
    writeFileSync(configPath, JSON.stringify({ gist_id: "abc123" }));
    // Overwrite mock gh to fail
    writeFileSync(join(mockGhDir, "gh"), "#!/bin/bash\nexit 1\n", { mode: 0o755 });

    const result = await runEmit(baseEvent, makeEnv());

    expect(result.exitCode).toBe(0);
  });

  it("extracts file_path from Edit event", async () => {
    writeFileSync(configPath, JSON.stringify({ gist_id: "abc123" }));

    const result = await runEmit(baseEvent, makeEnv());

    expect(result.ghCalls[0]).toContain("src/auth.ts");
  });

  it("extracts file_path from Read event", async () => {
    writeFileSync(configPath, JSON.stringify({ gist_id: "abc123" }));
    const readEvent = JSON.stringify({
      session_id: "s1",
      tool_name: "Read",
      tool_input: { file_path: "README.md" },
    });

    const result = await runEmit(readEvent, makeEnv());

    expect(result.ghCalls[0]).toContain("README.md");
  });

  it("handles Bash tool input", async () => {
    writeFileSync(configPath, JSON.stringify({ gist_id: "abc123" }));
    const bashEvent = JSON.stringify({
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });

    const result = await runEmit(bashEvent, makeEnv());

    expect(result.exitCode).toBe(0);
    expect(result.ghCalls).toHaveLength(1);
  });
});
