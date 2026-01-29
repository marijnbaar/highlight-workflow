import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import { loadConfig, getProject, listProjects } from '../utils/config.js';
import { getNote, updateNote, listNotes } from './notes.js';
import type { Note, NoteLink, ProjectConfig } from '../types.js';

// Extract keywords from text for similarity matching
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when',
    'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return new Set(words);
}

// Calculate similarity between two notes based on content and tags
function calculateSimilarity(note1: Note, note2: Note): number {
  if (note1.id === note2.id) return 0;

  let score = 0;

  // Tag overlap (high weight)
  const commonTags = note1.tags.filter(t => note2.tags.includes(t));
  score += commonTags.length * 20;

  // Keyword overlap in content
  const keywords1 = extractKeywords(note1.content + ' ' + note1.title);
  const keywords2 = extractKeywords(note2.content + ' ' + note2.title);

  let overlap = 0;
  keywords1.forEach(k => {
    if (keywords2.has(k)) overlap++;
  });

  const totalKeywords = Math.max(keywords1.size, keywords2.size);
  if (totalKeywords > 0) {
    score += (overlap / totalKeywords) * 50;
  }

  // Same project bonus
  if (note1.project === note2.project) {
    score += 10;
  }

  // Date proximity (notes close in time might be related)
  const date1 = new Date(note1.date).getTime();
  const date2 = new Date(note2.date).getTime();
  const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 7) {
    score += 10 - daysDiff;
  }

  // Action point assignee overlap
  const assignees1 = new Set(note1.actionPoints.map(ap => ap.assignee).filter(Boolean));
  const assignees2 = new Set(note2.actionPoints.map(ap => ap.assignee).filter(Boolean));
  assignees1.forEach(a => {
    if (assignees2.has(a)) score += 5;
  });

  return Math.round(score);
}

// Find related notes across all projects
export function findRelatedNotes(
  projectName: string,
  noteId: string,
  limit: number = 5,
  minScore: number = 15
): NoteLink[] {
  const sourceNote = getNote(projectName, noteId);
  if (!sourceNote) return [];

  const config = loadConfig();
  const allNotes: Note[] = [];

  // Gather all notes from all projects
  for (const project of config.projects) {
    const notes = listNotes(project.name);
    allNotes.push(...notes);
  }

  // Calculate similarity scores
  const scored = allNotes
    .map(note => ({
      note,
      score: calculateSimilarity(sourceNote, note),
    }))
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(item => ({
    noteId: item.note.id,
    noteTitle: item.note.title,
    project: item.note.project,
    linkType: 'related' as const,
    relevanceScore: item.score,
  }));
}

// Manually link two notes (bidirectional)
export function linkNotes(
  sourceProject: string,
  sourceNoteId: string,
  targetProject: string,
  targetNoteId: string
): { success: boolean; message: string } {
  const sourceNote = getNote(sourceProject, sourceNoteId);
  const targetNote = getNote(targetProject, targetNoteId);

  if (!sourceNote || !targetNote) {
    return { success: false, message: 'One or both notes not found' };
  }

  // Initialize linkedNotes if not present
  if (!sourceNote.linkedNotes) sourceNote.linkedNotes = [];
  if (!targetNote.linkedNotes) targetNote.linkedNotes = [];

  // Check if already linked
  const alreadyLinked = sourceNote.linkedNotes.some(l => l.noteId === targetNoteId);
  if (alreadyLinked) {
    return { success: false, message: 'Notes are already linked' };
  }

  // Add link to source note
  sourceNote.linkedNotes.push({
    noteId: targetNoteId,
    noteTitle: targetNote.title,
    project: targetProject,
    linkType: 'manual',
  });

  // Add backlink to target note
  targetNote.linkedNotes.push({
    noteId: sourceNoteId,
    noteTitle: sourceNote.title,
    project: sourceProject,
    linkType: 'backlink',
  });

  // Update both notes
  updateNote(sourceProject, sourceNoteId, { linkedNotes: sourceNote.linkedNotes });
  updateNote(targetProject, targetNoteId, { linkedNotes: targetNote.linkedNotes });

  return { success: true, message: `Linked "${sourceNote.title}" ↔ "${targetNote.title}"` };
}

// Unlink two notes
export function unlinkNotes(
  sourceProject: string,
  sourceNoteId: string,
  targetProject: string,
  targetNoteId: string
): { success: boolean; message: string } {
  const sourceNote = getNote(sourceProject, sourceNoteId);
  const targetNote = getNote(targetProject, targetNoteId);

  if (!sourceNote || !targetNote) {
    return { success: false, message: 'One or both notes not found' };
  }

  // Remove from source
  if (sourceNote.linkedNotes) {
    sourceNote.linkedNotes = sourceNote.linkedNotes.filter(l => l.noteId !== targetNoteId);
    updateNote(sourceProject, sourceNoteId, { linkedNotes: sourceNote.linkedNotes });
  }

  // Remove from target
  if (targetNote.linkedNotes) {
    targetNote.linkedNotes = targetNote.linkedNotes.filter(l => l.noteId !== sourceNoteId);
    updateNote(targetProject, targetNoteId, { linkedNotes: targetNote.linkedNotes });
  }

  return { success: true, message: 'Notes unlinked' };
}

// Get all linked notes for a note
export function getLinkedNotes(projectName: string, noteId: string): NoteLink[] {
  const note = getNote(projectName, noteId);
  if (!note) return [];
  return note.linkedNotes || [];
}

// Auto-link related notes and add them to the note
export function autoLinkRelatedNotes(
  projectName: string,
  noteId: string,
  limit: number = 3,
  minScore: number = 20
): NoteLink[] {
  const related = findRelatedNotes(projectName, noteId, limit, minScore);

  if (related.length === 0) return [];

  const note = getNote(projectName, noteId);
  if (!note) return [];

  // Initialize linkedNotes if not present
  if (!note.linkedNotes) note.linkedNotes = [];

  // Add related notes that aren't already linked
  const newLinks: NoteLink[] = [];
  for (const rel of related) {
    const alreadyLinked = note.linkedNotes.some(l => l.noteId === rel.noteId);
    if (!alreadyLinked) {
      note.linkedNotes.push(rel);
      newLinks.push(rel);
    }
  }

  if (newLinks.length > 0) {
    updateNote(projectName, noteId, { linkedNotes: note.linkedNotes });
  }

  return newLinks;
}

// Generate Obsidian-style wikilinks in note content
export function generateObsidianLinks(note: Note): string {
  if (!note.linkedNotes || note.linkedNotes.length === 0) {
    return note.content;
  }

  let content = note.content;

  // Add a "Related Notes" section if not present
  if (!content.includes('## Related Notes') && !content.includes('## Linked Notes')) {
    const linksSection = [
      '',
      '---',
      '',
      '## Related Notes',
      '',
      ...note.linkedNotes.map(link => {
        const icon = link.linkType === 'backlink' ? '⬅️' : link.linkType === 'related' ? '🔗' : '➡️';
        const score = link.relevanceScore ? ` (${link.relevanceScore}% match)` : '';
        return `- ${icon} [[${link.noteTitle}]]${score}`;
      }),
    ].join('\n');

    content += linksSection;
  }

  return content;
}

// Update note content with Obsidian wikilinks
export function updateNoteWithObsidianLinks(projectName: string, noteId: string): Note | null {
  const note = getNote(projectName, noteId);
  if (!note) return null;

  const updatedContent = generateObsidianLinks(note);
  return updateNote(projectName, noteId, { content: updatedContent });
}

// Find all notes that mention a specific note (by title)
export function findBacklinks(projectName: string, noteId: string): NoteLink[] {
  const targetNote = getNote(projectName, noteId);
  if (!targetNote) return [];

  const config = loadConfig();
  const backlinks: NoteLink[] = [];

  for (const project of config.projects) {
    const notes = listNotes(project.name);
    for (const note of notes) {
      if (note.id === noteId) continue;

      // Check if note content contains wikilink to target
      const wikiLinkPattern = new RegExp(`\\[\\[${targetNote.title}\\]\\]`, 'i');
      const titleMention = note.content.toLowerCase().includes(targetNote.title.toLowerCase());

      if (wikiLinkPattern.test(note.content) || titleMention) {
        backlinks.push({
          noteId: note.id,
          noteTitle: note.title,
          project: project.name,
          linkType: 'backlink',
        });
      }
    }
  }

  return backlinks;
}

// Get a graph representation of note connections
export function getNoteGraph(projectName?: string): {
  nodes: Array<{ id: string; title: string; project: string }>;
  edges: Array<{ source: string; target: string; type: string }>;
} {
  const config = loadConfig();
  const projects = projectName
    ? config.projects.filter(p => p.name === projectName)
    : config.projects;

  const nodes: Array<{ id: string; title: string; project: string }> = [];
  const edges: Array<{ source: string; target: string; type: string }> = [];
  const seenEdges = new Set<string>();

  for (const project of projects) {
    const notes = listNotes(project.name);
    for (const note of notes) {
      nodes.push({
        id: note.id,
        title: note.title,
        project: project.name,
      });

      if (note.linkedNotes) {
        for (const link of note.linkedNotes) {
          // Avoid duplicate edges
          const edgeKey = [note.id, link.noteId].sort().join('-');
          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({
              source: note.id,
              target: link.noteId,
              type: link.linkType,
            });
          }
        }
      }
    }
  }

  return { nodes, edges };
}
