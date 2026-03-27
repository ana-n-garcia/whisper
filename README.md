# Whisper

> Two minds, one frequency.

Whisper is a P2P context-sharing system between Claude Code sessions. It lets two people working in Claude share awareness of what the other is thinking about — like pair programming with shared intuition.

One session emits signals. The other picks them up. You control the frequency, the intensity, how raw it goes. And when your thoughts overlap — Whisper tells you.

## How It Works

```
Ana's Claude Session                    Ben's Claude Session
        │                                       │
        ├── hook fires on every action           │
        │   (file edit, search, conversation)    │
        │                                        │
        ▼                                        │
   emit.js formats                               │
   the event + posts          ┌──────────┐       │
   as a gist comment ────────►│  GitHub  │       │
                              │   Gist   │       │
   whisper_pulse() ◄──────────│ (shared  │◄──────┤ whisper_pulse()
   reads peer context         │ channel) │       │ reads peer context
        │                     └──────────┘       │
        ▼                                        ▼
  "Ben is also working              "Ana is thinking about
   on token refresh"                 the same auth flow"
```

A GitHub Gist acts as the shared channel. No custom servers, no infra. Just two Claude sessions whispering to each other through GitHub's API.

## Architecture

### 1. Event Capture — Claude Code Hooks

Claude Code supports hooks that fire on tool calls and responses. Whisper taps into these to capture what a session is doing:

```jsonc
// .claude/settings.json
{
  "hooks": {
    "tool_call": ["node ~/.whisper/emit.js"],
    "assistant_response": ["node ~/.whisper/emit.js"]
  }
}
```

Every file read, edit, grep, and conversation turn becomes a signal.

### 2. Transport — GitHub Gists

A secret GitHub Gist is the shared channel between two sessions:

- Each session posts context as **gist comments** via `gh api`
- Each session reads peer comments to pick up the other's context
- The gist URL is the **pairing code** — share it to connect
- History is naturally preserved and browsable

No servers. No WebSockets. Just GitHub.

### 3. Shared Context — MCP Server

A custom MCP server that both Claude sessions connect to. This is the brain:

```
whisper-mcp-server/
├── index.ts              # MCP server entrypoint
├── gist.ts               # GitHub Gist read/write
├── matcher.ts            # Overlap detection between sessions
└── summarizer.ts         # Compress raw events at different intensities
```

**Exposed tools:**

| Tool | Description |
|------|-------------|
| `whisper_connect(gist_url)` | Pair with another session |
| `whisper_pulse()` | Check what your peer is thinking about |
| `whisper_broadcast(context)` | Explicitly share something |
| `whisper_history(n)` | Recent shared context |
| `whisper_set_intensity(level)` | Control how much flows |

### 4. The Intensity Dial

Control how much context flows between sessions:

| Level | What Flows | Feels Like |
|-------|-----------|------------|
| `low` | File paths touched, topic keywords | Ambient awareness |
| `medium` | Summaries of actions and reasoning | Working in the same room |
| `high` | Raw diffs, full conversation context | Finishing each other's sentences |

At `low`, a fast model (Haiku) summarizes raw events into short topic signals. At `high`, everything goes through unfiltered.

### 5. Overlap Detection — "Hey, Ana is thinking about this"

The matcher checks for convergence between sessions:

- **File overlap** — both sessions touching the same files
- **Search overlap** — similar grep/glob patterns
- **Semantic overlap** — embed recent conversation chunks, cosine similarity

When overlap crosses a threshold, the MCP server surfaces it as a notification in the peer's session.

## Project Structure

```
whisper/
├── README.md
├── package.json
├── mcp-server/           # The Whisper MCP server
│   ├── index.ts          # Server entrypoint
│   ├── tools/            # MCP tool definitions
│   │   ├── connect.ts
│   │   ├── pulse.ts
│   │   ├── broadcast.ts
│   │   └── history.ts
│   ├── gist.ts           # GitHub Gist API layer
│   ├── matcher.ts        # Overlap detection
│   └── summarizer.ts     # Event compression
├── hooks/                # Claude Code hook scripts
│   └── emit.js           # Captures and emits session events
└── setup.sh              # One-command install + pairing
```

## Getting Started

```bash
# Clone and install
git clone https://github.com/ana-onwards/whisper.git
cd whisper && npm install

# Start a whisper channel (creates a gist, gives you a pairing code)
npx whisper init

# Your partner connects
npx whisper join <pairing-code>

# Both sessions now whisper to each other
```

## Roadmap

- [ ] **v0.1** — Hook script + gist transport (emit and read events)
- [ ] **v0.2** — MCP server with `whisper_pulse()` and `whisper_broadcast()`
- [ ] **v0.3** — Intensity dial and summarizer
- [ ] **v0.4** — Overlap detection and automatic notifications
- [ ] **v0.5** — Multi-session support (more than two minds)

## Why Gists?

- Zero infrastructure — no servers to run
- Already authenticated — `gh` CLI handles auth
- Already shared — GitHub permissions model for free
- Naturally persistent — the thought stream is browsable history
- Rate limits are generous enough for ambient awareness (~30-60s intervals)

---

*Two Claude sessions. One shared frequency. Start whispering.*
