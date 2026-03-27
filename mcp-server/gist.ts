import { execSync } from "node:child_process";
import type { WhisperEvent } from "./types.ts";

export interface CreateGistResult {
  id: string;
  html_url: string;
}

export function createGist(sessionId: string): CreateGistResult {
  const content = JSON.stringify({
    created: new Date().toISOString(),
    session: sessionId,
  });

  const result = execSync(
    `gh api gists -X POST -f 'description=whisper-channel' -F 'public=false' -f 'files[whisper.json][content]=${escapeShell(content)}'`,
    { encoding: "utf-8", timeout: 10000 },
  );

  const parsed = JSON.parse(result);
  return { id: parsed.id, html_url: parsed.html_url };
}

export function postComment(gistId: string, event: WhisperEvent): void {
  const body = JSON.stringify(event);
  execSync(
    `gh api gists/${encodeURIComponent(gistId)}/comments -f body=${escapeShellArg(body)}`,
    { encoding: "utf-8", timeout: 10000 },
  );
}

export interface ReadCommentsResult {
  events: WhisperEvent[];
  lastId: number | undefined;
}

export function readComments(
  gistId: string,
  sinceId?: number,
): ReadCommentsResult {
  const result = execSync(
    `gh api gists/${encodeURIComponent(gistId)}/comments`,
    { encoding: "utf-8", timeout: 10000 },
  );

  const comments: Array<{ id: number; body: string }> = JSON.parse(result);
  const events: WhisperEvent[] = [];
  let lastId: number | undefined;

  for (const comment of comments) {
    if (sinceId !== undefined && comment.id <= sinceId) {
      continue;
    }
    try {
      const event: WhisperEvent = JSON.parse(comment.body);
      events.push(event);
    } catch {
      // Skip malformed comments
    }
    if (lastId === undefined || comment.id > lastId) {
      lastId = comment.id;
    }
  }

  return { events, lastId };
}

function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''");
}

function escapeShellArg(str: string): string {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}
