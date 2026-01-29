import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import open from 'open';
import { loadConfig } from '../utils/config.js';
import type { EmailDraft, ActionPoint } from '../types.js';

// Create mailto: URL for default mail app
function createMailtoUrl(draft: EmailDraft): string {
  const params = new URLSearchParams();

  if (draft.cc?.length) {
    params.set('cc', draft.cc.join(','));
  }

  if (draft.bcc?.length) {
    params.set('bcc', draft.bcc.join(','));
  }

  params.set('subject', draft.subject);
  params.set('body', draft.body);

  return `mailto:${draft.to.join(',')}?${params.toString()}`;
}

// Open draft in default mail app
export async function openEmailDraft(draft: EmailDraft): Promise<string> {
  const mailtoUrl = createMailtoUrl(draft);
  await open(mailtoUrl);
  return 'Email draft opened in default mail app';
}

// Send via Gmail API
export async function sendGmail(draft: EmailDraft): Promise<string> {
  const config = loadConfig();

  if (!config.google) {
    throw new Error('Google credentials not configured. Run: highlight-workflow config google');
  }

  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: config.google.refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Build email in RFC 2822 format
  const emailLines = [
    `To: ${draft.to.join(', ')}`,
    draft.cc?.length ? `Cc: ${draft.cc.join(', ')}` : '',
    draft.bcc?.length ? `Bcc: ${draft.bcc.join(', ')}` : '',
    `Subject: ${draft.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    draft.body,
  ].filter(Boolean);

  const email = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(email).toString('base64url');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
    },
  });

  return `Email sent via Gmail. Message ID: ${response.data.id}`;
}

// Create draft in Gmail (doesn't send)
export async function createGmailDraft(draft: EmailDraft): Promise<string> {
  const config = loadConfig();

  if (!config.google) {
    throw new Error('Google credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: config.google.refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const emailLines = [
    `To: ${draft.to.join(', ')}`,
    draft.cc?.length ? `Cc: ${draft.cc.join(', ')}` : '',
    draft.bcc?.length ? `Bcc: ${draft.bcc.join(', ')}` : '',
    `Subject: ${draft.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    draft.body,
  ].filter(Boolean);

  const email = emailLines.join('\r\n');
  const encodedEmail = Buffer.from(email).toString('base64url');

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedEmail,
      },
    },
  });

  return `Draft created in Gmail. Draft ID: ${response.data.id}`;
}

// Send via Outlook API
export async function sendOutlookEmail(draft: EmailDraft): Promise<string> {
  const config = loadConfig();

  if (!config.microsoft) {
    throw new Error('Microsoft credentials not configured. Run: highlight-workflow config microsoft');
  }

  const client = Client.init({
    authProvider: (done) => {
      done(null, config.microsoft!.refreshToken);
    },
  });

  const message = {
    subject: draft.subject,
    body: {
      contentType: 'Text',
      content: draft.body,
    },
    toRecipients: draft.to.map(email => ({
      emailAddress: { address: email },
    })),
    ccRecipients: draft.cc?.map(email => ({
      emailAddress: { address: email },
    })),
    bccRecipients: draft.bcc?.map(email => ({
      emailAddress: { address: email },
    })),
  };

  await client.api('/me/sendMail').post({ message });

  return 'Email sent via Outlook';
}

// Create draft in Outlook
export async function createOutlookDraft(draft: EmailDraft): Promise<string> {
  const config = loadConfig();

  if (!config.microsoft) {
    throw new Error('Microsoft credentials not configured');
  }

  const client = Client.init({
    authProvider: (done) => {
      done(null, config.microsoft!.refreshToken);
    },
  });

  const message = {
    subject: draft.subject,
    body: {
      contentType: 'Text',
      content: draft.body,
    },
    toRecipients: draft.to.map(email => ({
      emailAddress: { address: email },
    })),
    ccRecipients: draft.cc?.map(email => ({
      emailAddress: { address: email },
    })),
    bccRecipients: draft.bcc?.map(email => ({
      emailAddress: { address: email },
    })),
  };

  const response = await client.api('/me/messages').post(message);

  return `Draft created in Outlook. Message ID: ${response.id}`;
}

// Unified email interface
export async function sendEmail(
  draft: EmailDraft,
  method?: 'draft' | 'gmail' | 'outlook'
): Promise<string> {
  const config = loadConfig();
  const useMethod = method || config.defaultEmailMethod;

  switch (useMethod) {
    case 'draft':
      return openEmailDraft(draft);
    case 'gmail':
      return sendGmail(draft);
    case 'outlook':
      return sendOutlookEmail(draft);
    default:
      return openEmailDraft(draft);
  }
}

// Generate email content from action points
export function generateActionPointsEmail(
  actionPoints: ActionPoint[],
  subject?: string
): EmailDraft {
  const pendingActions = actionPoints.filter(ap => ap.status !== 'completed');

  const body = [
    'Hi,',
    '',
    'Here are the action points from our recent meeting:',
    '',
    ...pendingActions.map((ap, i) => {
      let line = `${i + 1}. ${ap.description}`;
      if (ap.assignee) line += ` (Assigned to: ${ap.assignee})`;
      if (ap.dueDate) line += ` - Due: ${ap.dueDate}`;
      return line;
    }),
    '',
    'Please review and let me know if you have any questions.',
    '',
    'Best regards',
  ].join('\n');

  return {
    to: [],
    subject: subject || 'Action Points - Meeting Follow-up',
    body,
  };
}
