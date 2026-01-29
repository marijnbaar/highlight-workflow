import { google, calendar_v3 } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { loadConfig } from '../utils/config.js';
import type { CalendarEvent } from '../types.js';

// Google Calendar Service
export async function createGoogleCalendarEvent(event: CalendarEvent): Promise<string> {
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

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const calendarEvent: calendar_v3.Schema$Event = {
    summary: event.title,
    description: event.description,
    start: {
      dateTime: event.startTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: event.attendees?.map(email => ({ email })),
    location: event.location,
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: calendarEvent,
  });

  return response.data.htmlLink || response.data.id || 'Event created';
}

export async function listGoogleCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
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

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startDate,
    timeMax: endDate,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || []).map(event => ({
    title: event.summary || 'Untitled',
    description: event.description || undefined,
    startTime: event.start?.dateTime || event.start?.date || '',
    endTime: event.end?.dateTime || event.end?.date || '',
    attendees: event.attendees?.map(a => a.email || '').filter(Boolean),
    location: event.location || undefined,
  }));
}

// Microsoft Outlook Calendar Service
function getMicrosoftClient(): Client {
  const config = loadConfig();

  if (!config.microsoft) {
    throw new Error('Microsoft credentials not configured. Run: highlight-workflow config microsoft');
  }

  return Client.init({
    authProvider: (done) => {
      done(null, config.microsoft!.refreshToken);
    },
  });
}

export async function createOutlookCalendarEvent(event: CalendarEvent): Promise<string> {
  const client = getMicrosoftClient();

  const calendarEvent = {
    subject: event.title,
    body: {
      contentType: 'Text',
      content: event.description || '',
    },
    start: {
      dateTime: event.startTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    location: event.location ? { displayName: event.location } : undefined,
    attendees: event.attendees?.map(email => ({
      emailAddress: { address: email },
      type: 'required',
    })),
  };

  const response = await client.api('/me/events').post(calendarEvent);

  return response.webLink || response.id || 'Event created';
}

export async function listOutlookCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const client = getMicrosoftClient();

  const response = await client
    .api('/me/calendarview')
    .query({
      startDateTime: startDate,
      endDateTime: endDate,
    })
    .orderby('start/dateTime')
    .get();

  return (response.value || []).map((event: Record<string, unknown>) => ({
    title: (event.subject as string) || 'Untitled',
    description: (event.body as { content?: string })?.content,
    startTime: (event.start as { dateTime?: string })?.dateTime || '',
    endTime: (event.end as { dateTime?: string })?.dateTime || '',
    attendees: ((event.attendees as Array<{ emailAddress?: { address?: string } }>) || [])
      .map(a => a.emailAddress?.address || '')
      .filter(Boolean),
    location: (event.location as { displayName?: string })?.displayName,
  }));
}

// Unified calendar interface
export async function createCalendarEvent(
  event: CalendarEvent,
  provider?: 'google' | 'outlook'
): Promise<string> {
  const config = loadConfig();
  const useProvider = provider || config.defaultCalendar;

  if (useProvider === 'google') {
    return createGoogleCalendarEvent(event);
  } else {
    return createOutlookCalendarEvent(event);
  }
}

export async function listCalendarEvents(
  startDate: string,
  endDate: string,
  provider?: 'google' | 'outlook'
): Promise<CalendarEvent[]> {
  const config = loadConfig();
  const useProvider = provider || config.defaultCalendar;

  if (useProvider === 'google') {
    return listGoogleCalendarEvents(startDate, endDate);
  } else {
    return listOutlookCalendarEvents(startDate, endDate);
  }
}
