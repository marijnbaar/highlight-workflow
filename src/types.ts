export interface ProjectConfig {
  name: string;
  path: string;
  storage: 'obsidian' | 'local' | 'notion';
}

export interface NoteLink {
  noteId: string;
  noteTitle: string;
  project: string;
  linkType: 'manual' | 'related' | 'backlink';
  relevanceScore?: number;
}

export interface Note {
  id: string;
  title: string;
  date: string;
  project: string;
  content: string;
  actionPoints: ActionPoint[];
  tags: string[];
  linkedNotes: NoteLink[];
  createdAt: string;
  updatedAt: string;
}

export interface ActionPoint {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  noteId: string;
}

export interface CalendarEvent {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
  location?: string;
}

export interface EmailDraft {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

export interface Config {
  projects: ProjectConfig[];
  defaultProject: string;
  storageBasePath: string;
  obsidianVaultPath?: string;
  notionApiKey?: string;
  notionDatabaseId?: string;
  google?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  microsoft?: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    refreshToken: string;
  };
  defaultCalendar: 'google' | 'outlook';
  defaultEmailMethod: 'draft' | 'gmail' | 'outlook';
}
