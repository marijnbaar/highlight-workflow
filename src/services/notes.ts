import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import { format } from 'date-fns';
import { loadConfig, getProject } from '../utils/config.js';
import type { Note, ActionPoint, ProjectConfig, NoteLink } from '../types.js';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getProjectPath(project: ProjectConfig): string {
  const config = loadConfig();

  switch (project.storage) {
    case 'obsidian':
      return join(config.obsidianVaultPath || config.storageBasePath, project.path);
    case 'notion':
      return join(config.storageBasePath, 'notion-cache', project.path);
    case 'local':
    default:
      return join(config.storageBasePath, project.path);
  }
}

function ensureProjectDir(project: ProjectConfig): string {
  const path = getProjectPath(project);
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
  return path;
}

function noteToMarkdown(note: Note): string {
  const frontmatter = {
    id: note.id,
    title: note.title,
    date: note.date,
    project: note.project,
    tags: note.tags,
    linkedNotes: note.linkedNotes,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    actionPoints: note.actionPoints,
  };

  return matter.stringify(note.content, frontmatter);
}

function markdownToNote(content: string, filename: string): Note {
  const parsed = matter(content);
  const data = parsed.data as Partial<Note>;

  return {
    id: data.id || generateId(),
    title: data.title || basename(filename, '.md'),
    date: data.date || format(new Date(), 'yyyy-MM-dd'),
    project: data.project || '',
    content: parsed.content,
    actionPoints: (data.actionPoints as ActionPoint[]) || [],
    tags: data.tags || [],
    linkedNotes: (data.linkedNotes as NoteLink[]) || [],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

export function createNote(
  projectName: string,
  title: string,
  content: string,
  tags: string[] = []
): Note {
  const project = getProject(projectName);
  if (!project) {
    throw new Error(`Project "${projectName}" not found`);
  }

  const projectPath = ensureProjectDir(project);
  const date = format(new Date(), 'yyyy-MM-dd');
  const now = new Date().toISOString();

  const note: Note = {
    id: generateId(),
    title,
    date,
    project: projectName,
    content,
    actionPoints: [],
    tags,
    linkedNotes: [],
    createdAt: now,
    updatedAt: now,
  };

  const filename = `${date}-${sanitizeFilename(title)}.md`;
  const filepath = join(projectPath, filename);

  writeFileSync(filepath, noteToMarkdown(note));

  return note;
}

export function updateNote(
  projectName: string,
  noteId: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'actionPoints' | 'linkedNotes'>>
): Note | null {
  const project = getProject(projectName);
  if (!project) {
    throw new Error(`Project "${projectName}" not found`);
  }

  const projectPath = getProjectPath(project);
  const files = readdirSync(projectPath).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filepath = join(projectPath, file);
    const content = readFileSync(filepath, 'utf-8');
    const note = markdownToNote(content, file);

    if (note.id === noteId) {
      const updatedNote: Note = {
        ...note,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      writeFileSync(filepath, noteToMarkdown(updatedNote));
      return updatedNote;
    }
  }

  return null;
}

export function getNote(projectName: string, noteId: string): Note | null {
  const project = getProject(projectName);
  if (!project) {
    return null;
  }

  const projectPath = getProjectPath(project);
  if (!existsSync(projectPath)) {
    return null;
  }

  const files = readdirSync(projectPath).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const filepath = join(projectPath, file);
    const content = readFileSync(filepath, 'utf-8');
    const note = markdownToNote(content, file);

    if (note.id === noteId) {
      return note;
    }
  }

  return null;
}

export function listNotes(projectName: string): Note[] {
  const project = getProject(projectName);
  if (!project) {
    return [];
  }

  const projectPath = getProjectPath(project);
  if (!existsSync(projectPath)) {
    return [];
  }

  const files = readdirSync(projectPath).filter(f => f.endsWith('.md'));
  const notes: Note[] = [];

  for (const file of files) {
    const filepath = join(projectPath, file);
    const content = readFileSync(filepath, 'utf-8');
    notes.push(markdownToNote(content, file));
  }

  return notes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function addActionPoint(
  projectName: string,
  noteId: string,
  actionPoint: Omit<ActionPoint, 'id' | 'noteId'>
): ActionPoint | null {
  const note = getNote(projectName, noteId);
  if (!note) {
    return null;
  }

  const newActionPoint: ActionPoint = {
    ...actionPoint,
    id: generateId(),
    noteId,
  };

  note.actionPoints.push(newActionPoint);
  updateNote(projectName, noteId, { actionPoints: note.actionPoints });

  return newActionPoint;
}

export function getAllActionPoints(projectName?: string): ActionPoint[] {
  const config = loadConfig();
  const projects = projectName
    ? config.projects.filter(p => p.name === projectName)
    : config.projects;

  const actionPoints: ActionPoint[] = [];

  for (const project of projects) {
    const notes = listNotes(project.name);
    for (const note of notes) {
      actionPoints.push(...note.actionPoints);
    }
  }

  return actionPoints;
}

export function getPendingActionPoints(projectName?: string): ActionPoint[] {
  return getAllActionPoints(projectName).filter(ap => ap.status !== 'completed');
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}
