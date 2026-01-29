import { z } from 'zod';
import {
  createNote,
  updateNote,
  getNote,
  listNotes,
  addActionPoint,
  getAllActionPoints,
  getPendingActionPoints,
} from '../services/notes.js';
import { extractActionPoints } from '../services/actionExtractor.js';
import { addProject, listProjects, loadConfig } from '../utils/config.js';
import type { ActionPoint } from '../types.js';

export const noteToolSchemas = {
  add_note: z.object({
    project: z.string().describe('Name of the project to add the note to'),
    title: z.string().describe('Title of the note'),
    content: z.string().describe('Content of the note (markdown supported)'),
    tags: z.array(z.string()).optional().describe('Optional tags for the note'),
    extractActions: z.boolean().optional().describe('Automatically extract action points from content'),
  }),

  get_note: z.object({
    project: z.string().describe('Project name'),
    noteId: z.string().describe('ID of the note to retrieve'),
  }),

  list_notes: z.object({
    project: z.string().describe('Project name to list notes from'),
  }),

  add_action_point: z.object({
    project: z.string().describe('Project name'),
    noteId: z.string().describe('ID of the note to add action point to'),
    description: z.string().describe('Description of the action point'),
    assignee: z.string().optional().describe('Person assigned to this action'),
    dueDate: z.string().optional().describe('Due date for the action'),
    priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Priority level'),
  }),

  list_action_points: z.object({
    project: z.string().optional().describe('Filter by project (optional, shows all if omitted)'),
    pendingOnly: z.boolean().default(true).describe('Show only pending action points'),
  }),

  extract_action_points: z.object({
    content: z.string().describe('Text content to extract action points from'),
  }),

  add_project: z.object({
    name: z.string().describe('Project name (e.g., "work", "personal", "client-x")'),
    path: z.string().describe('Subfolder path for the project'),
    storage: z.enum(['obsidian', 'local', 'notion']).default('local').describe('Storage backend'),
  }),

  list_projects: z.object({}),
};

export const noteToolHandlers = {
  async add_note(args: z.infer<typeof noteToolSchemas.add_note>) {
    const note = createNote(args.project, args.title, args.content, args.tags);

    if (args.extractActions) {
      const extracted = extractActionPoints(args.content);
      for (const action of extracted) {
        addActionPoint(args.project, note.id, {
          description: action.description,
          assignee: action.assignee,
          dueDate: action.dueDate,
          priority: action.priority,
          status: 'pending',
        });
      }

      const updatedNote = getNote(args.project, note.id);
      return {
        success: true,
        note: updatedNote,
        extractedActions: extracted.length,
        message: `Note created with ${extracted.length} action points extracted`,
      };
    }

    return {
      success: true,
      note,
      message: `Note "${note.title}" created in project "${args.project}"`,
    };
  },

  async get_note(args: z.infer<typeof noteToolSchemas.get_note>) {
    const note = getNote(args.project, args.noteId);
    if (!note) {
      return { success: false, error: 'Note not found' };
    }
    return { success: true, note };
  },

  async list_notes(args: z.infer<typeof noteToolSchemas.list_notes>) {
    const notes = listNotes(args.project);
    return {
      success: true,
      count: notes.length,
      notes: notes.map(n => ({
        id: n.id,
        title: n.title,
        date: n.date,
        tags: n.tags,
        actionPointCount: n.actionPoints.length,
      })),
    };
  },

  async add_action_point(args: z.infer<typeof noteToolSchemas.add_action_point>) {
    const actionPoint = addActionPoint(args.project, args.noteId, {
      description: args.description,
      assignee: args.assignee,
      dueDate: args.dueDate,
      priority: args.priority,
      status: 'pending',
    });

    if (!actionPoint) {
      return { success: false, error: 'Note not found' };
    }

    return {
      success: true,
      actionPoint,
      message: 'Action point added',
    };
  },

  async list_action_points(args: z.infer<typeof noteToolSchemas.list_action_points>) {
    const actions = args.pendingOnly
      ? getPendingActionPoints(args.project)
      : getAllActionPoints(args.project);

    return {
      success: true,
      count: actions.length,
      actionPoints: actions,
    };
  },

  async extract_action_points(args: z.infer<typeof noteToolSchemas.extract_action_points>) {
    const extracted = extractActionPoints(args.content);
    return {
      success: true,
      count: extracted.length,
      actionPoints: extracted,
    };
  },

  async add_project(args: z.infer<typeof noteToolSchemas.add_project>) {
    const config = addProject({
      name: args.name,
      path: args.path,
      storage: args.storage,
    });

    return {
      success: true,
      message: `Project "${args.name}" added`,
      projectCount: config.projects.length,
    };
  },

  async list_projects() {
    const projects = listProjects();
    const config = loadConfig();

    return {
      success: true,
      defaultProject: config.defaultProject,
      projects: projects.map(p => ({
        name: p.name,
        path: p.path,
        storage: p.storage,
      })),
    };
  },
};
