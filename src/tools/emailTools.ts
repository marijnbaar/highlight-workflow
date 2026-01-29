import { z } from 'zod';
import {
  sendEmail,
  openEmailDraft,
  sendGmail,
  createGmailDraft,
  sendOutlookEmail,
  createOutlookDraft,
  generateActionPointsEmail,
} from '../services/email.js';
import { getPendingActionPoints, getNote } from '../services/notes.js';

export const emailToolSchemas = {
  compose_email: z.object({
    to: z.array(z.string()).describe('List of recipient email addresses'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    method: z.enum(['draft', 'gmail', 'outlook']).optional().describe('Send method (uses default if not specified)'),
    sendImmediately: z.boolean().default(false).describe('If true, sends immediately; otherwise creates draft'),
  }),

  email_action_points: z.object({
    to: z.array(z.string()).describe('Recipient email addresses'),
    project: z.string().optional().describe('Filter action points by project'),
    subject: z.string().optional().describe('Custom email subject'),
    method: z.enum(['draft', 'gmail', 'outlook']).optional().describe('Send method'),
    sendImmediately: z.boolean().default(false).describe('Send immediately or create draft'),
  }),

  email_meeting_summary: z.object({
    to: z.array(z.string()).describe('Recipient email addresses'),
    project: z.string().describe('Project name'),
    noteId: z.string().describe('Note ID containing meeting summary'),
    includeActionPoints: z.boolean().default(true).describe('Include action points in email'),
    method: z.enum(['draft', 'gmail', 'outlook']).optional().describe('Send method'),
    sendImmediately: z.boolean().default(false).describe('Send immediately or create draft'),
  }),

  open_email_draft: z.object({
    to: z.array(z.string()).describe('Recipient email addresses'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body'),
  }),
};

export const emailToolHandlers = {
  async compose_email(args: z.infer<typeof emailToolSchemas.compose_email>) {
    const draft = {
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      subject: args.subject,
      body: args.body,
    };

    if (args.sendImmediately) {
      const result = await sendEmail(draft, args.method);
      return {
        success: true,
        message: result,
        sent: true,
      };
    }

    // Create draft based on method
    let result: string;
    switch (args.method) {
      case 'gmail':
        result = await createGmailDraft(draft);
        break;
      case 'outlook':
        result = await createOutlookDraft(draft);
        break;
      case 'draft':
      default:
        result = await openEmailDraft(draft);
    }

    return {
      success: true,
      message: result,
      sent: false,
    };
  },

  async email_action_points(args: z.infer<typeof emailToolSchemas.email_action_points>) {
    const actionPoints = getPendingActionPoints(args.project);

    if (actionPoints.length === 0) {
      return {
        success: false,
        error: 'No pending action points to email',
      };
    }

    const emailDraft = generateActionPointsEmail(actionPoints, args.subject);
    emailDraft.to = args.to;

    if (args.sendImmediately) {
      const result = await sendEmail(emailDraft, args.method);
      return {
        success: true,
        message: result,
        actionPointCount: actionPoints.length,
        sent: true,
      };
    }

    let result: string;
    switch (args.method) {
      case 'gmail':
        result = await createGmailDraft(emailDraft);
        break;
      case 'outlook':
        result = await createOutlookDraft(emailDraft);
        break;
      default:
        result = await openEmailDraft(emailDraft);
    }

    return {
      success: true,
      message: result,
      actionPointCount: actionPoints.length,
      sent: false,
    };
  },

  async email_meeting_summary(args: z.infer<typeof emailToolSchemas.email_meeting_summary>) {
    const note = getNote(args.project, args.noteId);

    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    let body = `Hi,\n\nHere's a summary from our meeting on ${note.date}:\n\n`;
    body += note.content;

    if (args.includeActionPoints && note.actionPoints.length > 0) {
      body += '\n\n---\n\n## Action Points\n\n';
      note.actionPoints.forEach((ap, i) => {
        body += `${i + 1}. ${ap.description}`;
        if (ap.assignee) body += ` (${ap.assignee})`;
        if (ap.dueDate) body += ` - Due: ${ap.dueDate}`;
        body += '\n';
      });
    }

    body += '\n\nBest regards';

    const emailDraft = {
      to: args.to,
      subject: `Meeting Summary: ${note.title}`,
      body,
    };

    if (args.sendImmediately) {
      const result = await sendEmail(emailDraft, args.method);
      return {
        success: true,
        message: result,
        sent: true,
      };
    }

    let result: string;
    switch (args.method) {
      case 'gmail':
        result = await createGmailDraft(emailDraft);
        break;
      case 'outlook':
        result = await createOutlookDraft(emailDraft);
        break;
      default:
        result = await openEmailDraft(emailDraft);
    }

    return {
      success: true,
      message: result,
      sent: false,
    };
  },

  async open_email_draft(args: z.infer<typeof emailToolSchemas.open_email_draft>) {
    const result = await openEmailDraft({
      to: args.to,
      cc: args.cc,
      subject: args.subject,
      body: args.body,
    });

    return {
      success: true,
      message: result,
    };
  },
};
