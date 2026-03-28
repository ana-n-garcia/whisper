# Whisper

> Two minds, one frequency.

Whisper is a bidirectional context-sharing system between Claude Code sessions. It lets two people working in the same codebase share real-time awareness of what the other is doing — file edits, searches, reasoning — like pair programming with shared intuition.

Both sessions emit and receive. You control the intensity of what flows between them. And when your work overlaps — Whisper tells you.

## Getting Started

The fastest way to set up Whisper is the `/whisper` slash command inside Claude Code. It walks you through everything interactively:

```
> /whisper
```

You'll be asked:
1. **Create or join** — start a new channel, or paste a **GitHub Gist URL** to join an existing one
2. **Intensity** — `low`, `medium`, or `high` (see below)
3. **Check frequency** — how often to poll for peer activity (default: 5 min)
4. **Auto-expiration** — how many days before the channel expires (default: 7)

Once set up, share the **Gist URL** with your peer so they can join the same channel by running `/whisper` and pasting it in.

### Manual setup

```bash
# Clone and install
git clone https://github.com/ana-n-garcia/whisper.git
cd whisper && npm install

# Run the setup script to configure hooks and MCP server
bash setup.sh
```

Then run `/whisper` in Claude Code to create or join a channel.

## How It Works

```
Anakin's Claude Session                 Padme's Claude Session
        │                                       │
        ├── hook fires on every action           ├── hook fires on every action
        │   (file edit, search, command)         │   (file edit, search, command)
        │                                        │
        ▼                                        ▼
   emit.js formats                          emit.js formats
   the event + posts          ┌──────────┐  the event + posts
   as a gist comment ────────►│  GitHub  │◄──── as a gist comment
                              │   Gist   │
   whisper_pulse() ◄──────────│ (shared  │──────► whisper_pulse()
   reads peer context         │ channel) │        reads peer context
        │                     └──────────┘        │
        ▼                                         ▼
  "Padme is also working            "Anakin is thinking about
   on token refresh"                 the same auth flow"
```

A **GitHub Gist** acts as the shared channel. No custom servers, no infra. Both sessions post their activity as gist comments and read each other's. The gist URL is the pairing code.

## The Intensity Dial

Control how much context flows between sessions:

| Level | What Flows | Feels Like |
|-------|-----------|------------|
| `low` | File paths touched, topic keywords | Ambient awareness |
| `medium` | Summaries of actions and reasoning | Working in the same room |
| `high` | Raw diffs, full conversation context | Finishing each other's sentences |

## Architecture

### 1. Event Capture — Claude Code Hooks

Claude Code hooks fire after every tool call. Whisper's `emit.js` hook captures what a session is doing and posts it to the shared gist:

```jsonc
// ~/.claude/settings.json — hooks
{
  "hooks": {
    "PostToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node <whisper-dir>/hooks/emit.js" }] }]
  }
}

// ~/.claude.json — MCP server
{
  "mcpServers": {
    "whisper": {
      "command": "node",
      "args": ["--import", "tsx", "<whisper-dir>/mcp-server/index.ts"],
      "cwd": "<whisper-dir>"
    }
  }
}
```

### 2. Transport — GitHub Gists

A secret GitHub Gist is the shared channel:

- Each session posts context as **gist comments** via `gh api`
- Each session reads peer comments to pick up the other's context
- The **Gist URL** is the pairing code — share it to connect
- History is naturally preserved and browsable
- Zero infrastructure — `gh` CLI handles auth, GitHub handles permissions

### 3. MCP Server

A custom MCP server provides the tools both sessions use:

| Tool | Description |
|------|-------------|
| `whisper_setup` | One-step channel setup with all preferences |
| `whisper_connect(gist_url)` | Pair with another session via Gist URL |
| `whisper_pulse()` | Check what your peer is doing |
| `whisper_broadcast(context)` | Explicitly share something with your peer |
| `whisper_history(n)` | View recent shared context |
| `whisper_set_intensity(level)` | Change how much context flows |

### 4. Overlap Detection

The matcher checks for convergence between sessions:

- **File overlap** — both sessions touching the same files
- **Search overlap** — similar grep/glob patterns

When overlap is detected, `whisper_pulse` surfaces it as a notification.

## Project Structure

```
whisper/
├── README.md
├── package.json
├── mcp-server/           # The Whisper MCP server
│   ├── index.ts          # Server entrypoint (reads saved config on startup)
│   ├── types.ts          # Shared types
│   ├── tools/            # MCP tool definitions
│   │   ├── setup.ts      # One-step onboarding
│   │   ├── connect.ts    # Channel pairing
│   │   ├── pulse.ts      # Peer activity check
│   │   ├── broadcast.ts  # Explicit context sharing
│   │   ├── history.ts    # Activity log
│   │   └── set-intensity.ts
│   ├── gist.ts           # GitHub Gist API layer
│   ├── matcher.ts        # Overlap detection
│   └── summarizer.ts     # Event compression by intensity
├── hooks/                # Claude Code hook scripts
│   └── emit.js           # Captures and emits session events
└── setup.sh              # One-command install + pairing
```

## Why Gists?

- Zero infrastructure — no servers to run
- Already authenticated — `gh` CLI handles auth
- Already shared — GitHub permissions model for free
- Naturally persistent — the thought stream is browsable history
- Rate limits are generous enough for ambient awareness

---

*Two Claude sessions. One shared frequency. Start whispering.*
