import { NextResponse } from "next/server";
import { checkFreeBusy, listCalendarEvents } from "@/lib/googleCalendar";
import { listEmployees } from "@/lib/repository";

export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeEmails, date } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    // Create time range for the selected date (from midnight to midnight next day)
    const timeMin = new Date(date + "T00:00:00");
    const timeMax = new Date(date + "T23:59:59.999");

    // Fetch free/busy data
    let freeBusyData = {};
    let calendarEvents = [];

    if (employeeEmails && employeeEmails.length > 0) {
      freeBusyData = await checkFreeBusy(
        timeMin.toISOString(),
        timeMax.toISOString(),
        employeeEmails
      );

      calendarEvents = await listCalendarEvents(
        timeMin.toISOString(),
        timeMax.toISOString()
      );

      // Filter events that involve our selected employees
      const selectedEmails = new Set(employeeEmails.map(e => e.toLowerCase()));
      calendarEvents = calendarEvents.filter(event => {
        if (event.status === "cancelled") return false;
        const attendees = event.attendees || [];
        if (attendees.length === 0) return false;
        return attendees.some(attendee => 
          selectedEmails.has(attendee.email?.toLowerCase())
        );
      });
    }

    // Get employee details
    const allEmployees = await listEmployees();
    const selectedEmployees = allEmployees.filter(emp => 
      employeeEmails?.includes(emp.email)
    );

    return NextResponse.json({
      freeBusy: freeBusyData,
      calendarEvents: calendarEvents,
      employees: selectedEmployees
    });

  } catch (error) {
    console.error("[Availability API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability data" },
      { status: 500 }
    );
  }
}
