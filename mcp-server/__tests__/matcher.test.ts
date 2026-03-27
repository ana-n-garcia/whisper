import { describe, it, expect } from "vitest";
import { detectOverlap } from "../matcher.ts";
import type { WhisperEvent } from "../types.ts";

function makeEvent(overrides: Partial<WhisperEvent> = {}): WhisperEvent {
  return {
    session_id: "s1",
    timestamp: "2025-01-01T00:00:00Z",
    event_type: "tool_use",
    ...overrides,
  };
}

describe("detectOverlap", () => {
  it("detects file overlap", () => {
    const local = [makeEvent({ file_paths: ["src/auth.ts", "src/db.ts"] })];
    const peer = [makeEvent({ file_paths: ["src/auth.ts", "src/api.ts"] })];

    const result = detectOverlap(local, peer);

    expect(result.has_overlap).toBe(true);
    expect(result.file_overlaps).toEqual(["src/auth.ts"]);
  });

  it("returns no overlap when files differ", () => {
    const local = [makeEvent({ file_paths: ["src/a.ts"] })];
    const peer = [makeEvent({ file_paths: ["src/b.ts"] })];

    const result = detectOverlap(local, peer);

    expect(result.has_overlap).toBe(false);
    expect(result.file_overlaps).toEqual([]);
  });

  it("normalizes file paths (strips absolute prefix)", () => {
    const local = [makeEvent({ file_paths: ["/Users/ana/project/src/auth.ts"] })];
    const peer = [makeEvent({ file_paths: ["src/auth.ts"] })];

    const result = detectOverlap(local, peer);

    expect(result.has_overlap).toBe(true);
    expect(result.file_overlaps).toHaveLength(1);
  });

  it("detects search overlap (exact match)", () => {
    const local = [makeEvent({ search_patterns: ["token refresh"] })];
    const peer = [makeEvent({ search_patterns: ["token refresh"] })];

    const result = detectOverlap(local, peer);

    expect(result.has_overlap).toBe(true);
    expect(result.search_overlaps).toEqual(["token refresh"]);
  });

  it("detects search overlap (substring)", () => {
    const local = [makeEvent({ search_patterns: ["token"] })];
    const peer = [makeEvent({ search_patterns: ["token refresh"] })];

    const result = detectOverlap(local, peer);

    expect(result.has_overlap).toBe(true);
    expect(result.search_overlaps).toContain("token");
  });

  it("no search overlap for unrelated patterns", () => {
    const local = [makeEvent({ search_patterns: ["database"] })];
    const peer = [makeEvent({ search_patterns: ["authentication"] })];

    const result = detectOverlap(local, peer);

    expect(result.has_overlap).toBe(false);
    expect(result.search_overlaps).toEqual([]);
  });

  it("builds human-readable summary", () => {
    const local = [
      makeEvent({ file_paths: ["src/auth.ts"], search_patterns: ["token"] }),
    ];
    const peer = [
      makeEvent({ file_paths: ["src/auth.ts"], search_patterns: ["token refresh"] }),
    ];

    const result = detectOverlap(local, peer);

    expect(result.summary).toContain("src/auth.ts");
    expect(result.summary).toContain("token");
  });

  it("handles empty event arrays", () => {
    const result = detectOverlap([], []);

    expect(result.has_overlap).toBe(false);
    expect(result.file_overlaps).toEqual([]);
    expect(result.search_overlaps).toEqual([]);
    expect(result.summary).toBe("");
  });

  it("handles events with no file_paths or search_patterns", () => {
    const local = [makeEvent({ keywords: ["auth"] })];
    const peer = [makeEvent({ keywords: ["auth"] })];

    const result = detectOverlap(local, peer);

    expect(result.has_overlap).toBe(false);
  });
});
