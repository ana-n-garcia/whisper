import { describe, it, expect } from "vitest";
import {
  summarize,
  extractFilePaths,
  extractSearchPatterns,
  extractKeywords,
} from "../summarizer.ts";
import type { HookInput } from "../summarizer.ts";

describe("summarize", () => {
  const baseInput: HookInput = {
    session_id: "s1",
    tool_name: "Edit",
    tool_input: { file_path: "src/auth.ts", old_string: "a", new_string: "b" },
  };

  it("low intensity: only file_paths and keywords, no summary or raw_input", () => {
    const event = summarize(baseInput, "low");

    expect(event.file_paths).toEqual(["src/auth.ts"]);
    expect(event.keywords).toContain("auth");
    expect(event.summary).toBeUndefined();
    expect(event.raw_input).toBeUndefined();
  });

  it("medium intensity: includes summary, no raw_input", () => {
    const event = summarize(baseInput, "medium");

    expect(event.summary).toBe("Edited src/auth.ts");
    expect(event.raw_input).toBeUndefined();
  });

  it("high intensity: includes raw_input", () => {
    const event = summarize(baseInput, "high");

    expect(event.summary).toBe("Edited src/auth.ts");
    expect(event.raw_input).toEqual(baseInput.tool_input);
  });

  it("medium intensity: truncates long summaries", () => {
    const longInput: HookInput = {
      session_id: "s1",
      tool_name: "Bash",
      tool_input: { command: "a".repeat(250) },
    };

    const event = summarize(longInput, "medium");

    expect(event.summary!.length).toBeLessThanOrEqual(200);
    expect(event.summary!.endsWith("...")).toBe(true);
  });

  it("captures search patterns from Grep", () => {
    const grepInput: HookInput = {
      session_id: "s1",
      tool_name: "Grep",
      tool_input: { pattern: "token refresh", path: "src/" },
    };

    const event = summarize(grepInput, "medium");

    expect(event.search_patterns).toEqual(["token refresh"]);
    expect(event.summary).toContain("token refresh");
  });
});

describe("extractFilePaths", () => {
  it("handles Edit tool", () => {
    expect(extractFilePaths("Edit", { file_path: "src/auth.ts" })).toEqual(["src/auth.ts"]);
  });

  it("handles Read tool", () => {
    expect(extractFilePaths("Read", { file_path: "README.md" })).toEqual(["README.md"]);
  });

  it("handles Grep tool", () => {
    expect(extractFilePaths("Grep", { pattern: "foo", path: "src/" })).toEqual(["src/"]);
  });

  it("handles Glob tool", () => {
    expect(extractFilePaths("Glob", { pattern: "**/*.ts", path: "lib/" })).toEqual(["lib/"]);
  });

  it("handles Bash tool with file paths in command", () => {
    const paths = extractFilePaths("Bash", { command: "cat src/utils/helper.ts" });
    expect(paths).toContain("src/utils/helper.ts");
  });

  it("returns empty for unknown tools", () => {
    expect(extractFilePaths("SomethingElse", {})).toEqual([]);
  });
});

describe("extractSearchPatterns", () => {
  it("extracts Grep pattern", () => {
    expect(extractSearchPatterns("Grep", { pattern: "token" })).toEqual(["token"]);
  });

  it("extracts Glob pattern", () => {
    expect(extractSearchPatterns("Glob", { pattern: "**/*.ts" })).toEqual(["**/*.ts"]);
  });

  it("returns empty for non-search tools", () => {
    expect(extractSearchPatterns("Edit", { file_path: "a.ts" })).toEqual([]);
  });
});

describe("extractKeywords", () => {
  it("extracts meaningful segments from file paths", () => {
    const keywords = extractKeywords(["src/auth/token.ts"]);
    expect(keywords).toContain("auth");
    expect(keywords).toContain("token");
    expect(keywords).toContain("ts");
  });

  it("deduplicates keywords", () => {
    const keywords = extractKeywords(["src/auth.ts", "lib/auth.js"]);
    const authCount = keywords.filter((k) => k === "auth").length;
    expect(authCount).toBe(1);
  });

  it("filters noise words", () => {
    const keywords = extractKeywords(["src/index.ts", "node_modules/foo/dist/bar.js"]);
    expect(keywords).not.toContain("src");
    expect(keywords).not.toContain("index");
    expect(keywords).not.toContain("node_modules");
    expect(keywords).not.toContain("dist");
  });

  it("filters single-character segments", () => {
    const keywords = extractKeywords(["a/b/c.ts"]);
    expect(keywords).not.toContain("a");
    expect(keywords).not.toContain("b");
    expect(keywords).not.toContain("c");
  });
});
