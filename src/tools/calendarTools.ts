import { z } from 'zod';
import { createCalendarEvent, listCalendarEvents } from '../services/calendar.js';
import { getPendingActionPoints } from '../services/notes.js';
import { actionPointsToCalendarEvents } from '../services/actionExtractor.js';
import { addHours, format, parseISO } from 'date-fns';

export const calendarToolSchemas = {
  create_calendar_event: z.object({
    title: z.string().describe('Title of the event'),
    description: z.string().optional().describe('Event description'),
    startTime: z.string().describe('Start time in ISO format (e.g., 2024-01-15T10:00:00)'),
    endTime: z.string().optional().describe('End time in ISO format (defaults to 1 hour after start)'),
    attendees: z.array(z.string()).optional().describe('List of attendee email addresses'),
    location: z.string().optional().describe('Event location'),
    provider: z.enum(['google', 'outlook']).optional().describe('Calendar provider (uses default if not specified)'),
  }),

  list_calendar_events: z.object({
    startDate: z.string().describe('Start date in ISO format'),
    endDate: z.string().describe('End date in ISO format'),
    provider: z.enum(['google', 'outlook']).optional().describe('Calendar provider'),
  }),

  add_action_to_calendar: z.object({
    actionPointId: z.string().optional().describe('Specific action point ID to add'),
    project: z.string().optional().describe('Filter by project'),
    scheduleTime: z.string().describe('When to schedule the action (ISO format)'),
    duration: z.number().default(60).describe('Duration in minutes'),
    provider: z.enum(['google', 'outlook']).optional().describe('Calendar provider'),
  }),

  schedule_action_points: z.object({
    project: z.string().optional().describe('Filter by project'),
    startDate: z.string().describe('Start scheduling from this date (ISO format)'),
    slotDuration: z.number().default(30).describe('Duration per action point in minutes'),
    provider: z.enum(['google', 'outlook']).optional().describe('Calendar provider'),
  }),
};

export const calendarToolHandlers = {
  async create_calendar_event(args: z.infer<typeof calendarToolSchemas.create_calendar_event>) {
    const startTime = args.startTime;
    const endTime = args.endTime || format(addHours(parseISO(startTime), 1), "yyyy-MM-dd'T'HH:mm:ss");

    const result = await createCalendarEvent(
      {
        title: args.title,
        description: args.description,
        startTime,
        endTime,
        attendees: args.attendees,
        location: args.location,
      },
      args.provider
    );

    return {
      success: true,
      message: 'Calendar event created',
      link: result,
    };
  },

  async list_calendar_events(args: z.infer<typeof calendarToolSchemas.list_calendar_events>) {
    const events = await listCalendarEvents(args.startDate, args.endDate, args.provider);

    return {
      success: true,
      count: events.length,
      events: events.map(e => ({
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
        attendeeCount: e.attendees?.length || 0,
      })),
    };
  },

  async add_action_to_calendar(args: z.infer<typeof calendarToolSchemas.add_action_to_calendar>) {
    const actionPoints = getPendingActionPoints(args.project);

    if (args.actionPointId) {
      const actionPoint = actionPoints.find(ap => ap.id === args.actionPointId);
      if (!actionPoint) {
        return { success: false, error: 'Action point not found' };
      }

      const startTime = args.scheduleTime;
      const endTime = format(
        addHours(parseISO(startTime), args.duration / 60),
        "yyyy-MM-dd'T'HH:mm:ss"
      );

      const result = await createCalendarEvent(
        {
          title: `[Action] ${actionPoint.description.substring(0, 50)}`,
          description: `Priority: ${actionPoint.priority}\nAssignee: ${actionPoint.assignee || 'Unassigned'}\n\n${actionPoint.description}`,
          startTime,
          endTime,
        },
        args.provider
      );

      return {
        success: true,
        message: 'Action point added to calendar',
        link: result,
      };
    }

    return {
      success: false,
      error: 'No action point ID specified',
      availableActions: actionPoints.map(ap => ({
        id: ap.id,
        description: ap.description.substring(0, 100),
        priority: ap.priority,
      })),
    };
  },

  async schedule_action_points(args: z.infer<typeof calendarToolSchemas.schedule_action_points>) {
    const actionPoints = getPendingActionPoints(args.project);
    const calendarItems = actionPointsToCalendarEvents(actionPoints);

    if (calendarItems.length === 0) {
      return {
        success: true,
        message: 'No pending action points to schedule',
        scheduled: 0,
      };
    }

    const results: string[] = [];
    let currentTime = parseISO(args.startDate);

    for (const item of calendarItems) {
      const startTime = format(currentTime, "yyyy-MM-dd'T'HH:mm:ss");
      const endTime = format(
        addHours(currentTime, args.slotDuration / 60),
        "yyyy-MM-dd'T'HH:mm:ss"
      );

      try {
        const link = await createCalendarEvent(
          {
            title: item.title,
            description: item.description,
            startTime,
            endTime,
          },
          args.provider
        );
        results.push(link);
      } catch (error) {
        results.push(`Failed: ${item.title}`);
      }

      // Move to next slot
      currentTime = addHours(currentTime, args.slotDuration / 60);
    }

    return {
      success: true,
      message: `Scheduled ${results.length} action points`,
      scheduled: results.length,
      links: results,
    };
  },
};
