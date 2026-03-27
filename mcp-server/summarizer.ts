import type { Intensity, WhisperEvent } from "./types.ts";

export interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

const NOISE_WORDS = new Set([
  "src", "lib", "dist", "build", "node_modules", "index",
  "test", "tests", "__tests__", "spec", "tmp", "temp",
]);

const MAX_SUMMARY_LENGTH = 200;

export function summarize(
  hookInput: HookInput,
  intensity: Intensity,
): WhisperEvent {
  const filePaths = extractFilePaths(hookInput.tool_name, hookInput.tool_input);
  const searchPatterns = extractSearchPatterns(hookInput.tool_name, hookInput.tool_input);
  const keywords = extractKeywords(filePaths);

  const event: WhisperEvent = {
    session_id: hookInput.session_id,
    timestamp: new Date().toISOString(),
    event_type: "tool_use",
    tool_name: hookInput.tool_name,
    file_paths: filePaths.length > 0 ? filePaths : undefined,
    search_patterns: searchPatterns.length > 0 ? searchPatterns : undefined,
    keywords: keywords.length > 0 ? keywords : undefined,
  };

  if (intensity === "medium" || intensity === "high") {
    let summary = buildSummary(hookInput.tool_name, hookInput.tool_input, filePaths);
    if (summary.length > MAX_SUMMARY_LENGTH) {
      summary = summary.slice(0, MAX_SUMMARY_LENGTH - 3) + "...";
    }
    event.summary = summary;
  }

  if (intensity === "high") {
    event.raw_input = hookInput.tool_input;
  }

  return event;
}

export function extractFilePaths(
  toolName: string,
  toolInput: Record<string, unknown>,
): string[] {
  const paths: string[] = [];

  switch (toolName) {
    case "Edit":
    case "Read":
    case "Write":
      if (typeof toolInput.file_path === "string") {
        paths.push(toolInput.file_path);
      }
      break;
    case "Grep":
    case "Glob":
      if (typeof toolInput.path === "string") {
        paths.push(toolInput.path);
      }
      break;
    case "Bash":
      if (typeof toolInput.command === "string") {
        const fileMatches = toolInput.command.match(
          /(?:^|\s)((?:\.\/|\/)?[\w./-]+\.\w+)/g,
        );
        if (fileMatches) {
          for (const match of fileMatches) {
            paths.push(match.trim());
          }
        }
      }
      break;
  }

  return paths;
}

export function extractSearchPatterns(
  toolName: string,
  toolInput: Record<string, unknown>,
): string[] {
  const patterns: string[] = [];

  if (toolName === "Grep" && typeof toolInput.pattern === "string") {
    patterns.push(toolInput.pattern);
  }
  if (toolName === "Glob" && typeof toolInput.pattern === "string") {
    patterns.push(toolInput.pattern);
  }

  return patterns;
}

export function extractKeywords(filePaths: string[]): string[] {
  const keywords = new Set<string>();

  for (const filePath of filePaths) {
    const segments = filePath.split(/[/\\.]/).filter(Boolean);
    for (const segment of segments) {
      const lower = segment.toLowerCase();
      if (!NOISE_WORDS.has(lower) && lower.length > 1) {
        keywords.add(lower);
      }
    }
  }

  return [...keywords];
}

function buildSummary(
  toolName: string,
  toolInput: Record<string, unknown>,
  filePaths: string[],
): string {
  const fileStr = filePaths.length > 0 ? ` ${filePaths.join(", ")}` : "";

  switch (toolName) {
    case "Edit":
      return `Edited${fileStr}`;
    case "Read":
      return `Read${fileStr}`;
    case "Write":
      return `Wrote${fileStr}`;
    case "Grep":
      return `Searched for '${toolInput.pattern ?? ""}'${fileStr ? ` in${fileStr}` : ""}`;
    case "Glob":
      return `Searched for files matching '${toolInput.pattern ?? ""}'${fileStr ? ` in${fileStr}` : ""}`;
    case "Bash":
      if (typeof toolInput.command === "string") {
        const cmd = toolInput.command.length > 100
          ? toolInput.command.slice(0, 97) + "..."
          : toolInput.command;
        return `Ran: ${cmd}`;
      }
      return `Ran a command`;
    default:
      return `Used ${toolName}${fileStr}`;
  }
}
