import { google } from "googleapis";

// ---------------------------------------------------------------------------
// OAuth2 client — reused across calls (singleton pattern)
// ---------------------------------------------------------------------------
function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground" // redirect URI used to obtain the token
  );

  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return client;
}

function getCalendarClient() {
  const auth = getOAuth2Client();
  return google.calendar({ version: "v3", auth });
}

// ---------------------------------------------------------------------------
// Check if Google Calendar credentials are configured
// ---------------------------------------------------------------------------
function isGoogleCalendarConfigured() {
  return (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    process.env.GOOGLE_CALENDAR_ID
  );
}

// ---------------------------------------------------------------------------
// Build a Google Calendar event resource from meeting data
// ---------------------------------------------------------------------------
function buildCalendarEvent(meeting, attendees = []) {
  const {
    title,
    _composedTitle,
    agenda,
    scheduleDateTime,
    duration,
    zoomJoinUrl,
    zoomPassword,
    location,
    isVirtual,
  } = meeting;

  const eventTitle = _composedTitle || title;

  const startTime = new Date(scheduleDateTime);
  const endTime = new Date(startTime.getTime() + Number(duration) * 60 * 1000);

  const description = [
    agenda ? `📋 Agenda:\n${agenda}` : "",
    "",
    !isVirtual && location ? `📍 Location: ${location}` : "",
    zoomJoinUrl ? `🔗 Join Zoom Meeting:\n${zoomJoinUrl}` : "",
    zoomPassword ? `🔑 Password: ${zoomPassword}` : "",
    "",
    "This event was created by the Meeting Management System.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: eventTitle,
    description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    attendees: attendees.map((a) => ({
      email: a.email,
      displayName: a.firstName
        ? `${a.firstName} ${a.lastName || ""}`.trim()
        : a.name || undefined,
    })),
    // Use manual location for in-person, or Zoom link for virtual
    location: !isVirtual ? location : (zoomJoinUrl || ""),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 }, // 1 day before
        { method: "popup", minutes: 15 },        // 15 min before
      ],
    },
    // Visibility: default (attendees can see description)
    visibility: "default",
    status: "confirmed",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Google Calendar event and invite all attendees.
 * Returns the created event ID to be stored on the meeting document,
 * or null if Google Calendar is not configured.
 *
 * @param {object} meeting   - Meeting document with title, agenda, scheduleDateTime, duration, zoomJoinUrl, zoomPassword
 * @param {Array}  attendees - Array of { email, firstName?, lastName?, name? }
 * @returns {string|null}    - Google Calendar event ID
 */
export async function createCalendarEvent(meeting, attendees = []) {
  if (!isGoogleCalendarConfigured()) {
    console.warn(
      "[GoogleCalendar] Credentials not configured. Skipping Google Calendar event creation."
    );
    return null;
  }

  try {
    const calendar = getCalendarClient();
    const event = buildCalendarEvent(meeting, attendees);

    const response = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event,
      sendUpdates: "all", // Send invites to all attendees
    });

    const eventId = response.data.id;
    return eventId;
  } catch (error) {
    console.error("[GoogleCalendar] Failed to create event:", error.message);
    // Don't throw — calendar failure shouldn't block meeting creation
    return null;
  }
}

/**
 * Update an existing Google Calendar event.
 * If eventId is null (event was never created), tries to create a new one.
 *
 * @param {string} eventId   - Google Calendar event ID stored on the meeting
 * @param {object} meeting   - Updated meeting document
 * @param {Array}  attendees - Updated attendees array
 * @returns {string|null}    - Google Calendar event ID
 */
export async function updateCalendarEvent(eventId, meeting, attendees = []) {
  if (!isGoogleCalendarConfigured()) {
    console.warn("[GoogleCalendar] Credentials not configured. Skipping calendar update.");
    return null;
  }

  // If no eventId was stored, fall back to creating a new one
  if (!eventId) {
    return createCalendarEvent(meeting, attendees);
  }

  try {
    const calendar = getCalendarClient();
    const event = buildCalendarEvent(meeting, attendees);

    const response = await calendar.events.update({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId,
      resource: event,
      sendUpdates: "all", // Notify all attendees of the change
    });

    return response.data.id;
  } catch (error) {
    if (error.code === 404) {
      // Event not found — create a new one
      console.warn(`[GoogleCalendar] Event ${eventId} not found. Creating new event.`);
      return createCalendarEvent(meeting, attendees);
    }
    console.error("[GoogleCalendar] Failed to update event:", error.message);
    return eventId; // Return existing ID even on failure
  }
}

/**
 * Delete a Google Calendar event.
 *
 * @param {string} eventId - Google Calendar event ID to delete
 */
export async function deleteCalendarEvent(eventId) {
  if (!isGoogleCalendarConfigured()) {
    console.warn("[GoogleCalendar] Credentials not configured. Skipping calendar deletion.");
    return;
  }

  if (!eventId) return;

  try {
    const calendar = getCalendarClient();

    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId,
      sendUpdates: "all", // Notify attendees that the event is cancelled
    });

  } catch (error) {
    if (error.code === 404) {
      console.warn(`[GoogleCalendar] Event ${eventId} already deleted or not found.`);
      return;
    }
    console.error("[GoogleCalendar] Failed to delete event:", error.message);
  }
}

/**
 * List events from Google Calendar.
 *
 * @param {string} timeMin - ISO date string
 * @param {string} timeMax - ISO date string
 * @returns {Promise<Array>} - Array of events
 */
export async function listCalendarEvents(timeMin, timeMax) {
  if (!isGoogleCalendarConfigured()) {
    console.warn("[GoogleCalendar] Credentials not configured. Skipping event listing.");
    return [];
  }

  try {
    const calendar = getCalendarClient();
    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    return response.data.items || [];
  } catch (error) {
    console.error("[GoogleCalendar] Failed to list events:", error.message);
    return [];
  }
}

/**
 * Check free/busy times for one or more calendars/attendees.
 *
 * @param {string} timeMin - ISO date string for start of time range
 * @param {string} timeMax - ISO date string for end of time range
 * @param {Array<string>} calendarIds - Array of calendar IDs/emails to check
 * @returns {Promise<object>} - FreeBusy response from Google
 */
export async function checkFreeBusy(timeMin, timeMax, calendarIds) {
  if (!isGoogleCalendarConfigured()) {
    console.warn("[GoogleCalendar] Credentials not configured. Skipping free/busy check.");
    return { calendars: {} };
  }

  try {
    const calendar = getCalendarClient();
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: "Asia/Kolkata",
        items: calendarIds.map(id => ({ id })),
      },
    });

    return response.data || { calendars: {} };
  } catch (error) {
    console.error("[GoogleCalendar] Failed to check free/busy:", error.message);
    return { calendars: {} };
  }
}
