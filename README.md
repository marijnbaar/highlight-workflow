# Highlight Workflow

MCP server and CLI for managing notes, action points, calendar events, and emails with Highlight AI.

## Features

- **Notes Management**: Create and organize notes across multiple projects
- **Storage Options**: Obsidian vault, local filesystem, or Notion (all as markdown)
- **Note Linking**: Obsidian-style `[[wikilinks]]` with automatic related note discovery
- **Action Point Extraction**: Automatically extract action points from meeting notes
- **Calendar Integration**: Google Calendar and Outlook support
- **Email Integration**: Draft in default app, Gmail API, or Outlook API

## Installation

```bash
cd highlight-workflow
npm install
npm run build
```

## Quick Start

### 1. Add a project

```bash
highlight-workflow project:add work --storage local
highlight-workflow project:add personal --storage obsidian --path "Notes/Personal"
```

### 2. Create a note with action points

```bash
highlight-workflow note:add work "Team Meeting" --extract
```

### 3. Find and link related notes

```bash
highlight-workflow link:find work <noteId>
highlight-workflow link:auto work <noteId>
```

### 4. Add action to calendar

```bash
highlight-workflow calendar:add
```

### 5. Email action points

```bash
highlight-workflow email:actions team@company.com
```

## CLI Commands

### Projects

```bash
highlight-workflow project:add <name> [--path <path>] [--storage local|obsidian|notion]
highlight-workflow project:list
```

### Notes

```bash
highlight-workflow note:add <project> <title> [--content <content>] [--tags <tags>] [--extract]
highlight-workflow note:list <project>
```

### Note Linking

```bash
highlight-workflow link:find <project> <noteId>     # Find related notes
highlight-workflow link:add <srcProj> <srcId> <tgtProj> <tgtId>  # Manual link
highlight-workflow link:list <project> <noteId>     # Show linked notes
highlight-workflow link:auto <project> <noteId>     # Auto-link related notes
highlight-workflow link:obsidian <project> <noteId> # Add [[wikilinks]] to content
```

### Action Points

```bash
highlight-workflow action:list [--project <project>]
highlight-workflow action:add <project> <noteId> <description> [--assignee <name>] [--due <date>] [--priority low|medium|high]
```

### Calendar

```bash
highlight-workflow calendar:add [actionId] [--project <project>] [--time <datetime>] [--duration <minutes>] [--provider google|outlook]
```

### Email

```bash
highlight-workflow email:actions <to> [--project <project>] [--subject <subject>] [--method draft|gmail|outlook] [--send]
```

### Configuration

```bash
highlight-workflow config:show
highlight-workflow config:set <key> <value>
highlight-workflow config:google    # Configure Google OAuth
highlight-workflow config:microsoft # Configure Microsoft OAuth
```

## Highlight Integration (MCP Server)

See [HIGHLIGHT_SETUP.md](./HIGHLIGHT_SETUP.md) for detailed setup instructions.

### Quick Setup

1. Build the server:
   ```bash
   npm run build
   ```

2. In Highlight: Settings → Plugins → Custom Plugins

3. Add stdio plugin:
   - **Name**: highlight-workflow
   - **Command**: `node`
   - **Args**: `/path/to/highlight-workflow/dist/index.js`

### Available MCP Tools

| Category | Tools |
|----------|-------|
| **Notes** | `add_note`, `list_notes`, `get_note`, `add_project`, `list_projects` |
| **Actions** | `add_action_point`, `list_action_points`, `extract_action_points` |
| **Linking** | `find_related_notes`, `link_notes`, `unlink_notes`, `get_linked_notes`, `auto_link_notes`, `find_backlinks`, `get_note_graph`, `update_obsidian_links` |
| **Calendar** | `create_calendar_event`, `list_calendar_events`, `add_action_to_calendar`, `schedule_action_points` |
| **Email** | `compose_email`, `email_action_points`, `email_meeting_summary`, `open_email_draft` |

## Publishing to Marketplace

### Official MCP Registry

Submit to the [Official MCP Registry](https://registry.modelcontextprotocol.io/):

1. Validate with MCP Inspector:
   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. Use the [MCP Publisher](https://github.com/modelcontextprotocol/registry):
   ```bash
   ./bin/mcp-publisher
   ```

### Highlight's MCP Bundler

Highlight's [MCP Bundler](https://github.com/highlight-ing/mcp-bundler) can package GitHub repos for distribution.

### Cline Marketplace

Submit to [Cline's MCP Marketplace](https://github.com/cline/mcp-marketplace) with:
- GitHub repo URL
- 400×400 PNG logo
- Description

## Obsidian Note Linking

The plugin supports Obsidian-style note linking:

### Automatic Related Notes
```bash
# Find notes related by content, tags, date, and assignees
highlight-workflow link:find work abc123

# Auto-link top 3 related notes (20%+ match)
highlight-workflow link:auto work abc123
```

### Manual Linking
```bash
# Create bidirectional link between notes
highlight-workflow link:add work note1 work note2
```

### Obsidian Wikilinks
```bash
# Update note content with [[wikilinks]] section
highlight-workflow link:obsidian work abc123
```

This adds a "Related Notes" section with links like:
```markdown
## Related Notes

- 🔗 [[Sprint Planning 2024-01]] (45% match)
- ➡️ [[Client Requirements]]
- ⬅️ [[Previous Meeting]]
```

## Configuration

Config is stored at `~/.highlight-workflow/config.json`

### Storage Paths

```bash
# Set Obsidian vault path
highlight-workflow config:set obsidianVaultPath "/path/to/vault"

# Set default storage location
highlight-workflow config:set storageBasePath "~/Documents/Notes"
```

### Google OAuth Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API and Google Calendar API
3. Create OAuth 2.0 credentials (Web application)
4. Set redirect URI to `http://localhost:3000/code`
5. Run `highlight-workflow config:google` and enter credentials

### Microsoft OAuth Setup

1. Register an app in [Azure Portal](https://portal.azure.com)
2. Add Calendar.ReadWrite and Mail.Send permissions
3. Create client secret
4. Run `highlight-workflow config:microsoft` and enter credentials

## Example Workflow

```bash
# After a meeting, create a note with extracted action points
highlight-workflow note:add work "Sprint Planning 2024-01" \
  --content "$(cat meeting-transcript.txt)" \
  --tags "sprint,planning" \
  --extract

# Auto-link to related notes
highlight-workflow link:auto work <noteId>

# Update with Obsidian wikilinks
highlight-workflow link:obsidian work <noteId>

# Review action points
highlight-workflow action:list --project work

# Add high priority items to calendar
highlight-workflow calendar:add --project work

# Email the team with action points
highlight-workflow email:actions team@company.com \
  --project work \
  --subject "Sprint Planning Action Items"
```

## Using with Highlight Voice Commands

In Highlight, you can use natural language:

- "Add this meeting note to my work project and extract action points"
- "Find notes related to [note title]"
- "Link this note to [other note]"
- "Show me all pending action points"
- "Schedule the high priority action items on my Google Calendar"
- "Email the action points to the team"

## License

MIT
