import type { WhisperEvent } from "./types.ts";

export interface OverlapResult {
  has_overlap: boolean;
  file_overlaps: string[];
  search_overlaps: string[];
  summary: string;
}

export function detectOverlap(
  localEvents: WhisperEvent[],
  peerEvents: WhisperEvent[],
): OverlapResult {
  const localFiles = collectFilePaths(localEvents);
  const peerFiles = collectFilePaths(peerEvents);
  const fileOverlaps = intersect(localFiles, peerFiles);

  const localPatterns = collectSearchPatterns(localEvents);
  const peerPatterns = collectSearchPatterns(peerEvents);
  const searchOverlaps = findPatternOverlaps(localPatterns, peerPatterns);

  const hasOverlap = fileOverlaps.length > 0 || searchOverlaps.length > 0;

  return {
    has_overlap: hasOverlap,
    file_overlaps: fileOverlaps,
    search_overlaps: searchOverlaps,
    summary: hasOverlap ? buildSummary(fileOverlaps, searchOverlaps) : "",
  };
}

function collectFilePaths(events: WhisperEvent[]): Set<string> {
  const paths = new Set<string>();
  for (const event of events) {
    if (event.file_paths) {
      for (const p of event.file_paths) {
        paths.add(normalizePath(p));
      }
    }
  }
  return paths;
}

function collectSearchPatterns(events: WhisperEvent[]): Set<string> {
  const patterns = new Set<string>();
  for (const event of events) {
    if (event.search_patterns) {
      for (const p of event.search_patterns) {
        patterns.add(p);
      }
    }
  }
  return patterns;
}

function normalizePath(filePath: string): string {
  // Strip leading ./ and common absolute prefixes to get a relative path
  let p = filePath.replace(/^\.\//, "");
  // Strip /Users/<user>/<...>/ prefix down to the part starting with src/, lib/, etc.
  const match = p.match(/^\/.*?\/(src|lib|mcp-server|hooks|test|tests)\//);
  if (match) {
    p = p.slice(match.index! + match[0].length - match[1].length - 1);
  }
  return p;
}

function intersect(a: Set<string>, b: Set<string>): string[] {
  const result: string[] = [];
  for (const item of a) {
    if (b.has(item)) {
      result.push(item);
    }
  }
  return result.sort();
}

function findPatternOverlaps(a: Set<string>, b: Set<string>): string[] {
  const overlaps: string[] = [];
  for (const pa of a) {
    for (const pb of b) {
      if (pa === pb) {
        overlaps.push(pa);
      } else if (pa.length >= 3 && pb.includes(pa)) {
        overlaps.push(pa);
      } else if (pb.length >= 3 && pa.includes(pb)) {
        overlaps.push(pb);
      }
    }
  }
  return [...new Set(overlaps)].sort();
}

function buildSummary(
  fileOverlaps: string[],
  searchOverlaps: string[],
): string {
  const parts: string[] = [];

  if (fileOverlaps.length > 0) {
    parts.push(`Both sessions are working on ${fileOverlaps.join(", ")}`);
  }

  if (searchOverlaps.length > 0) {
    parts.push(`Similar searches: '${searchOverlaps.join("', '")}'`);
  }

  return parts.join(". ") + ".";
}
