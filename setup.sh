#!/bin/bash
set -e

WHISPER_DIR="$(cd "$(dirname "$0")" && pwd)"
WHISPER_HOME="$HOME/.whisper"
CLAUDE_CONFIG="$HOME/.claude.json"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

echo "Setting up Whisper..."

# Install dependencies
echo "Installing dependencies..."
cd "$WHISPER_DIR"
npm install --silent

# Create whisper home directory
mkdir -p "$WHISPER_HOME"

# Configure Claude Code MCP server in ~/.claude.json
echo "Configuring Claude Code MCP server..."

if [ ! -f "$CLAUDE_CONFIG" ]; then
  echo '{}' > "$CLAUDE_CONFIG"
fi

# Add MCP server config to ~/.claude.json
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));

if (!config.mcpServers) config.mcpServers = {};
const nodePath = require('child_process').execSync('which node').toString().trim();
config.mcpServers.whisper = {
  command: nodePath,
  args: ['--import', 'tsx', '$WHISPER_DIR/mcp-server/index.ts'],
  cwd: '$WHISPER_DIR',
};

fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2));
"

# Add PostToolUse hook to ~/.claude/settings.json
echo "Configuring Claude Code hooks..."
mkdir -p "$HOME/.claude"

if [ ! -f "$CLAUDE_SETTINGS" ]; then
  echo '{}' > "$CLAUDE_SETTINGS"
fi

node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$CLAUDE_SETTINGS', 'utf8'));

if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

const hookCmd = 'node $WHISPER_DIR/hooks/emit.js';
const hasHook = settings.hooks.PostToolUse.some(h =>
  h && h.hooks && h.hooks.some(hk => hk.command === hookCmd)
);

if (!hasHook) {
  settings.hooks.PostToolUse.push({
    matcher: '',
    hooks: [{
      type: 'command',
      command: hookCmd,
    }],
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
