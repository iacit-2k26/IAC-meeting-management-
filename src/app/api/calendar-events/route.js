import { NextResponse } from "next/server";
import { google } from "googleapis";

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

/**
 * GET /api/calendar-events?timeMin=ISO&timeMax=ISO
 * Fetches events from Google Calendar for the given time range.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  // Default: fetch 3 months around today
  const now = new Date();
  const defaultMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const defaultMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

  const timeMin = searchParams.get("timeMin") || defaultMin;
  const timeMax = searchParams.get("timeMax") || defaultMax;

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN ||
    !process.env.GOOGLE_CALENDAR_ID
  ) {
    return NextResponse.json({ events: [], error: "Google Calendar not configured." });
  }

  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      fields:
        "items(id,summary,description,start,end,location,attendees,status,colorId,htmlLink)",
    });

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || "(No title)",
      description: event.description || "",
      start: event.start?.dateTime || event.start?.date || null,
      end: event.end?.dateTime || event.end?.date || null,
      location: event.location || "",
      attendees: (event.attendees || []).map((a) => ({
        email: a.email,
        displayName: a.displayName || a.email,
        responseStatus: a.responseStatus,
      })),
      status: event.status,
      colorId: event.colorId,
      htmlLink: event.htmlLink,
      isAllDay: !event.start?.dateTime,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("[CalendarEventsAPI] Error:", error.message);
    return NextResponse.json({ events: [], error: error.message }, { status: 500 });
  }
}
