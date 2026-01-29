# Highlight AI Setup Guide

This guide walks you through setting up highlight-workflow as a custom plugin in Highlight AI.

## Prerequisites

1. [Highlight AI](https://highlightai.com) installed on your Mac
2. Node.js v18+ installed
3. This project built (`npm install && npm run build`)

## Step 1: Configure as Custom Plugin (stdio)

1. Open **Highlight** app
2. Go to **Settings** (⌘ + ,)
3. Navigate to **Plugins** → **Custom Plugins**
4. Click **Add Plugin**
5. Configure:
   - **Plugin Type**: `stdio`
   - **Plugin Name**: `highlight-workflow`
   - **Command**: `node`
   - **Args**: `/Users/marijnbaar/Code/highlight-workflow/dist/index.js`

6. Click **Save** and enable the plugin

## Step 2: Verify Installation

In Highlight, try saying:
- "List my projects"
- "Add a project called 'work' with local storage"

You should see the MCP tools responding.

## Available Commands in Highlight

### Note Management
- "Add a note to [project] titled [title]"
- "List notes in [project]"
- "Extract action points from this text"

### Note Linking (Obsidian-style)
- "Find notes related to [note]"
- "Link [note1] to [note2]"
- "Show linked notes for [note]"
- "Auto-link related notes for [note]"

### Calendar
- "Add [action point] to my Google Calendar"
- "Schedule all pending action points"
- "List calendar events for this week"

### Email
- "Email the action points to [email]"
- "Send meeting summary to [email]"
- "Open email draft with action points"

## Publishing to MCP Registry

### Option 1: Official MCP Registry

The [Official MCP Registry](https://registry.modelcontextprotocol.io/) is the canonical source for MCP servers.

1. **Prepare your server**:
   ```bash
   # Validate with MCP Inspector
   npx @modelcontextprotocol/inspector
   ```

2. **Create a GitHub repository** for your plugin

3. **Use the MCP Publisher CLI**:
   ```bash
   # Clone the registry repo
   git clone https://github.com/modelcontextprotocol/registry
   cd registry

   # Build the publisher
   make publisher

   # Publish (requires GitHub auth for namespace)
   ./bin/mcp-publisher --help
   ```

4. Your server will be available at: `io.github.[username]/highlight-workflow`

### Option 2: Highlight's MCP Bundler

Highlight provides an [MCP Bundler](https://github.com/highlight-ing/mcp-bundler) service that bundles MCP servers from GitHub for deployment.

1. Push your code to a public GitHub repository
2. The bundler can fetch and package your code
3. Users can then install via URL

### Option 3: Cline's MCP Marketplace

If you also want to support [Cline](https://github.com/cline/mcp-marketplace):

1. Create an issue at [cline/mcp-marketplace](https://github.com/cline/mcp-marketplace)
2. Include:
   - GitHub repo URL
   - 400×400 PNG logo
   - Description of why it's useful

## Existing Highlight Plugins

Highlight already has some official MCP servers you might want to use alongside this:

| Server | Description |
|--------|-------------|
| [google-calendar-mcp-server](https://github.com/highlight-ing/google-calendar-mcp-server) | Google Calendar integration |
| [gmail-mcp-server](https://github.com/highlight-ing/gmail-mcp-server) | Gmail integration |
| [gsuite-wasm-mcp](https://github.com/highlight-ing/gsuite-wasm-mcp) | Combined Google Workspace |

**Note**: If you're only using Google Calendar/Gmail, consider using Highlight's official plugins. This highlight-workflow plugin is best for:
- **Combined workflow** (notes → action points → calendar/email)
- **Obsidian integration** with note linking
- **Multi-project note organization**
- **Action point extraction and tracking**

## Keyboard Shortcuts

You can trigger Highlight with the default shortcut (usually `⌥ + Space`) and use natural language to interact with your notes.

For CLI usage outside Highlight:
```bash
# Add to your shell config for quick access
alias hw='node /Users/marijnbaar/Code/highlight-workflow/dist/cli.js'

# Then use:
hw project:list
hw note:add work "Meeting Notes"
hw link:auto work <noteId>
```

## Troubleshooting

### Plugin not loading
- Check Node.js is in your PATH
- Verify the absolute path to dist/index.js
- Check Highlight logs in Console.app

### OAuth errors
- Run `./dist/cli.js config:google` to reconfigure
- Ensure refresh token hasn't expired

### Notes not syncing with Obsidian
- Verify `obsidianVaultPath` is set correctly
- Check file permissions on the vault folder
