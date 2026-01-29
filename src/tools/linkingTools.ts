import { z } from 'zod';
import {
  findRelatedNotes,
  linkNotes,
  unlinkNotes,
  getLinkedNotes,
  autoLinkRelatedNotes,
  findBacklinks,
  getNoteGraph,
  updateNoteWithObsidianLinks,
} from '../services/noteLinking.js';

export const linkingToolSchemas = {
  find_related_notes: z.object({
    project: z.string().describe('Project name'),
    noteId: z.string().describe('Note ID to find related notes for'),
    limit: z.number().default(5).describe('Maximum number of related notes to return'),
    minScore: z.number().default(15).describe('Minimum relevance score (0-100)'),
  }),

  link_notes: z.object({
    sourceProject: z.string().describe('Source note project'),
    sourceNoteId: z.string().describe('Source note ID'),
    targetProject: z.string().describe('Target note project'),
    targetNoteId: z.string().describe('Target note ID'),
  }),

  unlink_notes: z.object({
    sourceProject: z.string().describe('Source note project'),
    sourceNoteId: z.string().describe('Source note ID'),
    targetProject: z.string().describe('Target note project'),
    targetNoteId: z.string().describe('Target note ID'),
  }),

  get_linked_notes: z.object({
    project: z.string().describe('Project name'),
    noteId: z.string().describe('Note ID'),
  }),

  auto_link_notes: z.object({
    project: z.string().describe('Project name'),
    noteId: z.string().describe('Note ID to auto-link'),
    limit: z.number().default(3).describe('Maximum number of notes to link'),
    minScore: z.number().default(20).describe('Minimum relevance score to auto-link'),
  }),

  find_backlinks: z.object({
    project: z.string().describe('Project name'),
    noteId: z.string().describe('Note ID to find backlinks for'),
  }),

  get_note_graph: z.object({
    project: z.string().optional().describe('Filter by project (optional)'),
  }),

  update_obsidian_links: z.object({
    project: z.string().describe('Project name'),
    noteId: z.string().describe('Note ID'),
  }),
};

export const linkingToolHandlers = {
  async find_related_notes(args: z.infer<typeof linkingToolSchemas.find_related_notes>) {
    const related = findRelatedNotes(args.project, args.noteId, args.limit, args.minScore);

    return {
      success: true,
      count: related.length,
      relatedNotes: related.map(r => ({
        noteId: r.noteId,
        title: r.noteTitle,
        project: r.project,
        relevanceScore: r.relevanceScore,
      })),
    };
  },

  async link_notes(args: z.infer<typeof linkingToolSchemas.link_notes>) {
    const result = linkNotes(
      args.sourceProject,
      args.sourceNoteId,
      args.targetProject,
      args.targetNoteId
    );

    return result;
  },

  async unlink_notes(args: z.infer<typeof linkingToolSchemas.unlink_notes>) {
    const result = unlinkNotes(
      args.sourceProject,
      args.sourceNoteId,
      args.targetProject,
      args.targetNoteId
    );

    return result;
  },

  async get_linked_notes(args: z.infer<typeof linkingToolSchemas.get_linked_notes>) {
    const links = getLinkedNotes(args.project, args.noteId);

    return {
      success: true,
      count: links.length,
      links: links.map(l => ({
        noteId: l.noteId,
        title: l.noteTitle,
        project: l.project,
        type: l.linkType,
        relevanceScore: l.relevanceScore,
      })),
    };
  },

  async auto_link_notes(args: z.infer<typeof linkingToolSchemas.auto_link_notes>) {
    const newLinks = autoLinkRelatedNotes(args.project, args.noteId, args.limit, args.minScore);

    return {
      success: true,
      linkedCount: newLinks.length,
      newLinks: newLinks.map(l => ({
        noteId: l.noteId,
        title: l.noteTitle,
        project: l.project,
        relevanceScore: l.relevanceScore,
      })),
      message: newLinks.length > 0
        ? `Auto-linked ${newLinks.length} related notes`
        : 'No new related notes found to link',
    };
  },

  async find_backlinks(args: z.infer<typeof linkingToolSchemas.find_backlinks>) {
    const backlinks = findBacklinks(args.project, args.noteId);

    return {
      success: true,
      count: backlinks.length,
      backlinks: backlinks.map(b => ({
        noteId: b.noteId,
        title: b.noteTitle,
        project: b.project,
      })),
    };
  },

  async get_note_graph(args: z.infer<typeof linkingToolSchemas.get_note_graph>) {
    const graph = getNoteGraph(args.project);

    return {
      success: true,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodes: graph.nodes,
      edges: graph.edges,
    };
  },

  async update_obsidian_links(args: z.infer<typeof linkingToolSchemas.update_obsidian_links>) {
    const note = updateNoteWithObsidianLinks(args.project, args.noteId);

    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    return {
      success: true,
      message: 'Note updated with Obsidian wikilinks',
      linkedCount: note.linkedNotes?.length || 0,
    };
  },
};
