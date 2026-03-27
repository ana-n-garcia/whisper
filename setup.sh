#!/bin/bash
set -e

WHISPER_DIR="$(cd "$(dirname "$0")" && pwd)"
WHISPER_HOME="$HOME/.whisper"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

echo "Setting up Whisper..."

# Install dependencies
echo "Installing dependencies..."
cd "$WHISPER_DIR"
npm install --silent

# Create whisper home directory
mkdir -p "$WHISPER_HOME"

# Configure Claude Code MCP server
echo "Configuring Claude Code MCP server..."
mkdir -p "$HOME/.claude"

if [ ! -f "$CLAUDE_SETTINGS" ]; then
  echo '{}' > "$CLAUDE_SETTINGS"
fi

# Add MCP server config
node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$CLAUDE_SETTINGS', 'utf8'));

// Add MCP server
if (!settings.mcpServers) settings.mcpServers = {};
settings.mcpServers.whisper = {
  command: 'npx',
  args: ['tsx', '$WHISPER_DIR/mcp-server/index.ts'],
};

// Add PostToolUse hook
if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

const hookCmd = 'node $WHISPER_DIR/hooks/emit.js';
const hasHook = settings.hooks.PostToolUse.some(h =>
  (typeof h === 'string' && h === hookCmd) ||
  (typeof h === 'object' && h.command === hookCmd)
);

if (!hasHook) {
  settings.hooks.PostToolUse.push({
    type: 'command',
    command: hookCmd,
  });
}

fs.writeFileSync('$CLAUDE_SETTINGS', JSON.stringify(settings, null, 2));
"

echo ""
echo "Whisper is ready!"
echo ""
echo "In Claude Code, use these tools:"
echo "  whisper_connect          — Create a new channel or join one"
echo "  whisper_pulse            — Check what your peer is working on"
echo "  whisper_broadcast        — Share context with your peer"
echo "  whisper_history          — View recent shared context"
echo "  whisper_set_intensity    — Control how much flows (low/medium/high)"
echo ""
echo "To start: ask Claude to 'use whisper_connect to create a channel'"
