#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_PATH = join(homedir(), ".whisper", "config.json");

function extractFilePaths(toolName, toolInput) {
  const paths = [];
  switch (toolName) {
    case "Edit":
    case "Read":
    case "Write":
      if (typeof toolInput.file_path === "string") paths.push(toolInput.file_path);
      break;
    case "Grep":
    case "Glob":
      if (typeof toolInput.path === "string") paths.push(toolInput.path);
      break;
    case "Bash":
      if (typeof toolInput.command === "string") {
        const matches = toolInput.command.match(/(?:^|\s)((?:\.\/|\/)?[\w./-]+\.\w+)/g);
        if (matches) {
          for (const m of matches) paths.push(m.trim());
        }
      }
      break;
  }
  return paths;
}

function extractKeywords(filePaths) {
  const noise = new Set(["src", "lib", "dist", "node_modules", "index", "test", "tests", "tmp"]);
  const keywords = new Set();
  for (const fp of filePaths) {
    for (const seg of fp.split(/[/\\.]/).filter(Boolean)) {
      const lower = seg.toLowerCase();
      if (!noise.has(lower) && lower.length > 1) keywords.add(lower);
    }
  }
  return [...keywords];
}

function main() {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    try {
      const event = JSON.parse(input);

      let config;
      try {
        config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      } catch {
        process.exit(0); // Not connected
      }

      const filePaths = extractFilePaths(event.tool_name, event.tool_input || {});
      const keywords = extractKeywords(filePaths);

      const whisperEvent = {
        session_id: event.session_id,
        timestamp: new Date().toISOString(),
        event_type: "tool_use",
        tool_name: event.tool_name,
        ...(filePaths.length > 0 && { file_paths: filePaths }),
        ...(keywords.length > 0 && { keywords }),
      };

      const body = JSON.stringify(whisperEvent);
      const escaped = body.replace(/'/g, "'\\''");
      execSync(`gh api gists/${config.gist_id}/comments -f body='${escaped}'`, {
        timeout: 5000,
        stdio: "ignore",
      });
    } catch {
      // Swallow all errors — hook must not block Claude
    }

    process.exit(0);
  });
}

main();
