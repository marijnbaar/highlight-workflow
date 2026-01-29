#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { noteToolSchemas, noteToolHandlers } from './tools/noteTools.js';
import { calendarToolSchemas, calendarToolHandlers } from './tools/calendarTools.js';
import { emailToolSchemas, emailToolHandlers } from './tools/emailTools.js';
import { linkingToolSchemas, linkingToolHandlers } from './tools/linkingTools.js';

const server = new Server(
  {
    name: 'highlight-workflow',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Combine all tool schemas
const allTools = {
  // Note tools
  add_note: {
    description: 'Create a new note in a project with optional automatic action point extraction',
    schema: noteToolSchemas.add_note,
    handler: noteToolHandlers.add_note,
  },
  get_note: {
    description: 'Retrieve a specific note by ID',
    schema: noteToolSchemas.get_note,
    handler: noteToolHandlers.get_note,
  },
  list_notes: {
    description: 'List all notes in a project',
    schema: noteToolSchemas.list_notes,
    handler: noteToolHandlers.list_notes,
  },
  add_action_point: {
    description: 'Add an action point to an existing note',
    schema: noteToolSchemas.add_action_point,
    handler: noteToolHandlers.add_action_point,
  },
  list_action_points: {
    description: 'List action points across projects',
    schema: noteToolSchemas.list_action_points,
    handler: noteToolHandlers.list_action_points,
  },
  extract_action_points: {
    description: 'Extract action points from text content using AI patterns',
    schema: noteToolSchemas.extract_action_points,
    handler: noteToolHandlers.extract_action_points,
  },
  add_project: {
    description: 'Add a new project for organizing notes',
    schema: noteToolSchemas.add_project,
    handler: noteToolHandlers.add_project,
  },
  list_projects: {
    description: 'List all configured projects',
    schema: noteToolSchemas.list_projects,
    handler: noteToolHandlers.list_projects,
  },

  // Calendar tools
  create_calendar_event: {
    description: 'Create a calendar event in Google Calendar or Outlook',
    schema: calendarToolSchemas.create_calendar_event,
    handler: calendarToolHandlers.create_calendar_event,
  },
  list_calendar_events: {
    description: 'List upcoming calendar events',
    schema: calendarToolSchemas.list_calendar_events,
    handler: calendarToolHandlers.list_calendar_events,
  },
  add_action_to_calendar: {
    description: 'Add a specific action point to your calendar',
    schema: calendarToolSchemas.add_action_to_calendar,
    handler: calendarToolHandlers.add_action_to_calendar,
  },
  schedule_action_points: {
    description: 'Bulk schedule all pending action points to calendar',
    schema: calendarToolSchemas.schedule_action_points,
    handler: calendarToolHandlers.schedule_action_points,
  },

  // Email tools
  compose_email: {
    description: 'Compose and send/draft an email',
    schema: emailToolSchemas.compose_email,
    handler: emailToolHandlers.compose_email,
  },
  email_action_points: {
    description: 'Email pending action points to recipients',
    schema: emailToolSchemas.email_action_points,
    handler: emailToolHandlers.email_action_points,
  },
  email_meeting_summary: {
    description: 'Email a meeting summary with action points',
    schema: emailToolSchemas.email_meeting_summary,
    handler: emailToolHandlers.email_meeting_summary,
  },
  open_email_draft: {
    description: 'Open an email draft in the default mail application',
    schema: emailToolSchemas.open_email_draft,
    handler: emailToolHandlers.open_email_draft,
  },

  // Note linking tools
  find_related_notes: {
    description: 'Find notes related to a specific note based on content similarity',
    schema: linkingToolSchemas.find_related_notes,
    handler: linkingToolHandlers.find_related_notes,
  },
  link_notes: {
    description: 'Create a bidirectional link between two notes (Obsidian-style)',
    schema: linkingToolSchemas.link_notes,
    handler: linkingToolHandlers.link_notes,
  },
  unlink_notes: {
    description: 'Remove the link between two notes',
    schema: linkingToolSchemas.unlink_notes,
    handler: linkingToolHandlers.unlink_notes,
  },
  get_linked_notes: {
    description: 'Get all notes linked to a specific note',
    schema: linkingToolSchemas.get_linked_notes,
    handler: linkingToolHandlers.get_linked_notes,
  },
  auto_link_notes: {
    description: 'Automatically find and link related notes based on similarity',
    schema: linkingToolSchemas.auto_link_notes,
    handler: linkingToolHandlers.auto_link_notes,
  },
  find_backlinks: {
    description: 'Find all notes that reference a specific note',
    schema: linkingToolSchemas.find_backlinks,
    handler: linkingToolHandlers.find_backlinks,
  },
  get_note_graph: {
    description: 'Get a graph representation of all note connections',
    schema: linkingToolSchemas.get_note_graph,
    handler: linkingToolHandlers.get_note_graph,
  },
  update_obsidian_links: {
    description: 'Update note content with Obsidian-style [[wikilinks]] for linked notes',
    schema: linkingToolSchemas.update_obsidian_links,
    handler: linkingToolHandlers.update_obsidian_links,
  },
};

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(allTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.schema.shape).map(([key, value]) => [
            key,
            { type: 'string', description: (value as { description?: string }).description },
          ])
        ),
      },
    })),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = allTools[name as keyof typeof allTools];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const validatedArgs = tool.schema.parse(args);
    const result = await tool.handler(validatedArgs as never);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: errorMessage }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Highlight Workflow MCP Server running on stdio');
}

main().catch(console.error);
