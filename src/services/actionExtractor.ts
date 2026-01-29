import type { ActionPoint } from '../types.js';

export interface ExtractedAction {
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}

const ACTION_PATTERNS = [
  // Direct action items: "Action: ...", "TODO: ...", "Task: ..."
  /(?:action|todo|task|to-do):\s*(.+?)(?:\n|$)/gi,
  // Bullet points with action verbs
  /[-*]\s+((?:need to|should|must|will|going to|have to)\s+.+?)(?:\n|$)/gi,
  // "@person will..." or "@person to..."
  /@(\w+)\s+(?:will|to|should)\s+(.+?)(?:\n|$)/gi,
  // "Follow up on...", "Schedule...", "Send...", etc.
  /[-*]\s+((?:follow up|schedule|send|review|prepare|create|update|check|confirm|contact|call|email|meet with|discuss)\s+.+?)(?:\n|$)/gi,
  // Deadline patterns: "by Friday", "before next week"
  /[-*]\s+(.+?)\s+(?:by|before|until|due)\s+(\w+(?:\s+\w+)?)/gi,
];

const PRIORITY_KEYWORDS = {
  high: ['urgent', 'asap', 'immediately', 'critical', 'priority', 'important', 'today'],
  medium: ['soon', 'this week', 'next few days'],
  low: ['eventually', 'when possible', 'low priority', 'nice to have'],
};

const ASSIGNEE_PATTERNS = [
  /@(\w+)/,
  /assigned to (\w+)/i,
  /(\w+) will/,
  /(\w+) to follow up/i,
  /(\w+) is responsible/i,
];

const DATE_PATTERNS = [
  /by (\w+ \d+)/i,
  /before (\w+ \d+)/i,
  /due (\w+ \d+)/i,
  /deadline:?\s*(\w+ \d+)/i,
  /(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /(next week|this week|end of week)/i,
];

function detectPriority(text: string): 'low' | 'medium' | 'high' {
  const lowerText = text.toLowerCase();

  for (const keyword of PRIORITY_KEYWORDS.high) {
    if (lowerText.includes(keyword)) return 'high';
  }

  for (const keyword of PRIORITY_KEYWORDS.medium) {
    if (lowerText.includes(keyword)) return 'medium';
  }

  for (const keyword of PRIORITY_KEYWORDS.low) {
    if (lowerText.includes(keyword)) return 'low';
  }

  return 'medium';
}

function extractAssignee(text: string): string | undefined {
  for (const pattern of ASSIGNEE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return undefined;
}

function extractDueDate(text: string): string | undefined {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return undefined;
}

function cleanDescription(text: string): string {
  return text
    .replace(/@\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractActionPoints(content: string): ExtractedAction[] {
  const actions: ExtractedAction[] = [];
  const seen = new Set<string>();

  for (const pattern of ACTION_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(content)) !== null) {
      const rawText = match[1] || match[2] || match[0];
      const description = cleanDescription(rawText);

      // Skip duplicates and very short items
      if (seen.has(description.toLowerCase()) || description.length < 10) {
        continue;
      }

      seen.add(description.toLowerCase());

      actions.push({
        description,
        assignee: extractAssignee(rawText),
        dueDate: extractDueDate(rawText),
        priority: detectPriority(rawText),
      });
    }
  }

  return actions;
}

export function formatActionPointsMarkdown(actionPoints: ActionPoint[]): string {
  if (actionPoints.length === 0) {
    return 'No action points found.';
  }

  const lines = ['## Action Points', ''];

  const byPriority = {
    high: actionPoints.filter(ap => ap.priority === 'high'),
    medium: actionPoints.filter(ap => ap.priority === 'medium'),
    low: actionPoints.filter(ap => ap.priority === 'low'),
  };

  for (const [priority, items] of Object.entries(byPriority)) {
    if (items.length === 0) continue;

    lines.push(`### ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`);
    lines.push('');

    for (const ap of items) {
      const checkbox = ap.status === 'completed' ? '[x]' : '[ ]';
      let line = `- ${checkbox} ${ap.description}`;

      if (ap.assignee) {
        line += ` (@${ap.assignee})`;
      }

      if (ap.dueDate) {
        line += ` - Due: ${ap.dueDate}`;
      }

      lines.push(line);
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function actionPointsToCalendarEvents(actionPoints: ActionPoint[]): Array<{
  title: string;
  description: string;
  dueDate?: string;
}> {
  return actionPoints
    .filter(ap => ap.status !== 'completed')
    .map(ap => ({
      title: `[Action] ${ap.description.substring(0, 50)}${ap.description.length > 50 ? '...' : ''}`,
      description: `Priority: ${ap.priority}\nAssignee: ${ap.assignee || 'Unassigned'}\n\n${ap.description}`,
      dueDate: ap.dueDate,
    }));
}
