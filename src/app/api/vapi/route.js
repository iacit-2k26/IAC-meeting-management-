import { NextResponse } from "next/server";
import {
  listDepartments,
  listEmployees,
  createMeeting,
  listMeetings,
  getZoomHostEmployee,
  getEmployeesByDepartment,
  deleteMeeting,
} from "@/lib/repository";
import { listCalendarEvents } from "@/lib/googleCalendar";

// ---------------------------------------------------------------------------
// POST /api/vapi
// Handles all VAPI webhook events: function calls (toolCalls & functionCall)
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    const body = await request.json();
    console.log("[Vapi Webhook Received]:", JSON.stringify(body, null, 2));

    const message = body.message || body;

    // ── Vapi newer format: message.toolCalls (array) ──────────────────────
    if (message?.toolCalls && Array.isArray(message.toolCalls)) {
      const results = await Promise.all(
        message.toolCalls.map(async (toolCall) => {
          const fnName = toolCall.function?.name;
          const fnParams = toolCall.function?.arguments
            ? typeof toolCall.function.arguments === "string"
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments
            : {};

          const result = await dispatchFunction(fnName, fnParams);

          return {
            toolCallId: toolCall.id,
            result,
          };
        })
      );

      return NextResponse.json({ results });
    }

    // ── Vapi legacy / standard format: message.functionCall (object) ──────
    if (message?.functionCall) {
      const { name, parameters } = message.functionCall;
      const result = await dispatchFunction(name, parameters || {});
      return NextResponse.json({ result });
    }

    // ── Direct functionCall at root (backwards compat) ────────────────────
    if (body.functionCall) {
      const { name, parameters } = body.functionCall;
      const result = await dispatchFunction(name, parameters || {});
      return NextResponse.json({ result });
    }

    // ── Health-check / test ping ──────────────────────────────────────────
    if (body.test) {
      return NextResponse.json({
        message: "Vapi endpoint is working! All functions are live.",
      });
    }

    // ── Default — Vapi status / session events (no action needed) ─────────
    return NextResponse.json({});
  } catch (error) {
    console.error("[Vapi API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 400 }
    );
  }
}

// ---------------------------------------------------------------------------
// Function dispatcher
// ---------------------------------------------------------------------------
async function dispatchFunction(name, params) {
  console.log(`[Vapi Function Call]: ${name}`, params);

  switch (name) {
    case "checkCalendar":
    case "queryMeetings":
      return checkCalendarFn(params);

    case "getDepartmentEmployees":
    case "getEmployeesByDept":
      return getDepartmentEmployeesFn(params);

    case "createMeeting":
      return createMeetingFn(params);

    case "cancelMeeting":
    case "deleteMeeting":
      return cancelMeetingFn(params);

    case "listDepartments":
      return listDepartmentsFn();

    case "listEmployees":
      return listEmployeesFn();

    default:
      return `Unknown function: "${name}". Available functions: checkCalendar, getDepartmentEmployees, createMeeting, listDepartments, listEmployees.`;
  }
}

// ---------------------------------------------------------------------------
// checkCalendar — merged Google Calendar + MongoDB for a given date
// All date boundaries computed in IST (Asia/Kolkata, UTC+5:30) to match
// the user's actual timezone and avoid wrong-day edge cases.
// ---------------------------------------------------------------------------
async function checkCalendarFn({ date } = {}) {
  const IST = "Asia/Kolkata";

  // Get current date-string in IST (YYYY-MM-DD)
  const nowISTStr = new Date().toLocaleDateString("en-CA", { timeZone: IST });

  let dateStr; // YYYY-MM-DD in IST

  if (!date || date === "today") {
    dateStr = nowISTStr;
  } else if (date === "tomorrow") {
    // Advance by 1 day from today in IST
    const [y, m, d] = nowISTStr.split("-").map(Number);
    const tomorrow = new Date(y, m - 1, d + 1);
    dateStr = tomorrow.toLocaleDateString("en-CA"); // local, but offset doesn't matter for arithmetic
    // Re-derive cleanly in IST
    const tomorrowIST = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    dateStr = tomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
  } else {
    // User said a specific date — parse as IST date
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return "I couldn't understand that date. Please say 'today', 'tomorrow', or a date like June 20th.";
    }
    dateStr = parsed.toLocaleDateString("en-CA", { timeZone: IST });
  }

  // Build IST day boundaries as ISO strings so Google Calendar API gets the right window
  const dayStartIST = new Date(`${dateStr}T00:00:00+05:30`); // midnight IST
  const dayEndIST   = new Date(`${dateStr}T23:59:59+05:30`); // 11:59:59 PM IST

  // Human-readable label ("Monday, 15 June 2026")
  const dateLabel = dayStartIST.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: IST,
  });

  console.log(`[checkCalendar] Checking IST date: ${dateStr} | window: ${dayStartIST.toISOString()} → ${dayEndIST.toISOString()}`);

  // Fetch from both sources in parallel using correct IST boundaries
  const [dbMeetings, calendarEvents] = await Promise.all([
    listMeetings(dayStartIST.toISOString()),
    listCalendarEvents(dayStartIST.toISOString(), dayEndIST.toISOString()),
  ]);

  // Filter DB meetings to this IST date
  const dbOnDate = dbMeetings.filter((m) => {
    const mDateIST = new Date(m.scheduleDateTime).toLocaleDateString("en-CA", { timeZone: IST });
    return mDateIST === dateStr;
  });

  // Google Calendar events NOT already captured in DB (deduplicate by googleEventId)
  const dbGCalIds = new Set(dbOnDate.map((m) => m.googleEventId).filter(Boolean));
  const gcalOnly = calendarEvents.filter(
    (ev) => ev.status !== "cancelled" && !dbGCalIds.has(ev.id)
  );

  // Build unified event list
  const allEvents = [
    ...dbOnDate.map((m) => ({
      title: m.title,
      time: new Date(m.scheduleDateTime).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: IST,
      }),
      source: "system",
    })),
    ...gcalOnly.map((ev) => {
      const start = ev.start?.dateTime || ev.start?.date;
      return {
        title: ev.summary || "(No title)",
        time: start
          ? new Date(start).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: IST,
            })
          : "All day",
        source: "calendar",
      };
    }),
  ];

  // Sort chronologically
  allEvents.sort((a, b) => a.time.localeCompare(b.time));

  if (allEvents.length === 0) {
    return `You have no meetings scheduled for ${dateLabel}.`;
  }

  const meetingList = allEvents
    .map(
      (ev, i) =>
        `${i + 1}. "${ev.title}" at ${ev.time}${ev.source === "calendar" ? " (Google Calendar)" : ""}`
    )
    .join(". ");

  return `You have ${allEvents.length} meeting${allEvents.length > 1 ? "s" : ""} on ${dateLabel}: ${meetingList}.`;
}

// ---------------------------------------------------------------------------
// getDepartmentEmployees — list active employees in a named department
// ---------------------------------------------------------------------------
async function getDepartmentEmployeesFn({ departmentName } = {}) {
  if (!departmentName) {
    return "Please tell me which department you'd like to check.";
  }

  const { department, employees } = await getEmployeesByDepartment(departmentName);

  if (!department) {
    const allDepts = await listDepartments();
    const names = allDepts.map((d) => d.name).join(", ");
    return `I couldn't find a department called "${departmentName}". Available departments are: ${names}.`;
  }

  if (employees.length === 0) {
    return `The ${department.name} department has no active employees right now.`;
  }

  const names = employees
    .map((e) => `${e.firstName} ${e.lastName} (${e.designation || "Employee"})`)
    .join(", ");

  return `The ${department.name} department has ${employees.length} active employee${employees.length > 1 ? "s" : ""}: ${names}. Should I go ahead and create a meeting for all of them?`;
}

// ---------------------------------------------------------------------------
// createMeeting — full pipeline: MongoDB lookup → Zoom → GCal → DB save
//
// Host resolution:
//   1. ZOOM_HOST_EMPLOYEE_ID env var  →  whoever owns the Zoom account
//   2. Fallback: first active employee in DB
//
// Attendees: all active employees of the requested department (auto-fetched)
// ---------------------------------------------------------------------------
async function createMeetingFn({
  departmentName,
  title,
  meetingType = "",
  time,
  duration = 30,
  agenda = "",
  location = "",
  isVirtual = true,
  externalAttendees = [],
  hostName = "",
} = {}) {
  // ── Validation ────────────────────────────────────────────────────────────
  if (!departmentName) {
    return "Please specify the department for the meeting.";
  }
  if (!title) {
    return "Please provide a meeting title.";
  }
  if (!time) {
    return "Please provide a date and time for the meeting.";
  }

  const scheduleDateTime = new Date(time);
  if (isNaN(scheduleDateTime.getTime())) {
    return `I couldn't understand the time "${time}". Please say something like "tomorrow at 3 PM" or "June 20th at 10 AM".`;
  }

  // ── Fetch department + its employees ─────────────────────────────────────
  const { department, employees } = await getEmployeesByDepartment(departmentName);

  if (!department) {
    const allDepts = await listDepartments();
    const names = allDepts.map((d) => d.name).join(", ");
    return `I couldn't find a department called "${departmentName}". Available departments: ${names}.`;
  }

  if (employees.length === 0) {
    return `The ${department.name} department has no active employees. I can't create a meeting without attendees.`;
  }

  // ── Resolve Zoom account owner as the default host ─────────────────────
  const zoomHost = await getZoomHostEmployee();

  if (!zoomHost) {
    return "I couldn't find the default meeting host in the system. Please set ZOOM_HOST_EMPLOYEE_ID in your configuration.";
  }

  // Resolve custom host if provided
  let hostEmployee = zoomHost;
  if (hostName) {
    const allEmployees = await listEmployees();
    const matchedHost = allEmployees.find(e => {
      const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
      const query = hostName.toLowerCase().trim();
      return fullName.includes(query) || e.firstName.toLowerCase() === query || e.lastName.toLowerCase() === query;
    });
    if (matchedHost) {
      hostEmployee = matchedHost;
      console.log(`[VAPI] Custom host resolved: ${hostEmployee.firstName} ${hostEmployee.lastName} (${hostEmployee.id})`);
    } else {
      console.warn(`[VAPI] Custom host "${hostName}" not found in DB — falling back to Zoom owner.`);
    }
  }

  // Add host and department members to the attendee IDs
  const deptEmpIds = new Set(employees.map((e) => e.id));
  const allAttendeeIds = [...deptEmpIds];
  if (hostEmployee && !deptEmpIds.has(hostEmployee.id)) {
    allAttendeeIds.push(hostEmployee.id);
  }

  // ── Build attendee names for the confirmation message ─────────────────
  const attendeeNames = employees
    .map((e) => `${e.firstName} ${e.lastName}`)
    .join(", ");

  // ── Create the meeting ────────────────────────────────────────────────
  try {
    const meeting = await createMeeting({
      title,
      meetingType,
      agenda,
      scheduleDateTime: scheduleDateTime.toISOString(),
      duration: Number(duration),
      location,
      isVirtual: Boolean(isVirtual),
      hostId: hostEmployee.id,           // ← Custom resolved host
      departmentIds: [department.id],
      internalAttendeeIds: allAttendeeIds,
      externalAttendees: externalAttendees || [],
    });

    const formattedTime = scheduleDateTime.toLocaleString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

    const actualHostName = `${hostEmployee.firstName} ${hostEmployee.lastName}`;
    const zoomInfo = meeting.zoomJoinUrl
      ? ` A Zoom link has been created and a Google Calendar invite has been sent to all attendees.`
      : ` This is set as an in-person meeting at ${location || "unspecified location"}.`;

    return (
      `Done! I've scheduled "${title}" (${meetingType || "Standard Meeting"}) for ${department.name} on ${formattedTime} ` +
      `(${duration} minutes). ` +
      `Hosted by ${actualHostName}. ` +
      `Attendees: ${attendeeNames}.` +
      zoomInfo
    );
  } catch (error) {
    console.error("[Vapi createMeeting error]:", error);
    return `Sorry, I couldn't create the meeting: ${error.message}`;
  }
}// ---------------------------------------------------------------------------
// listDepartments — voice-friendly list of all departments
// ---------------------------------------------------------------------------
async function listDepartmentsFn() {
  const departments = await listDepartments();
  if (departments.length === 0) return "There are no departments in the system yet.";
  const names = departments.map((d) => d.name).join(", ");
  return `There are ${departments.length} departments: ${names}.`;
}

// ---------------------------------------------------------------------------
// listEmployees — voice-friendly list of all employees
// ---------------------------------------------------------------------------
async function listEmployeesFn() {
  const employees = await listEmployees();
  if (employees.length === 0) return "There are no employees in the system yet.";
  const names = employees
    .map((e) => `${e.firstName} ${e.lastName}`)
    .join(", ");
  return `There are ${employees.length} employees: ${names}.`;
}

// ---------------------------------------------------------------------------
// cancelMeeting — cancel/delete a scheduled meeting
// Parameters: date (YYYY-MM-DD or 'today'/'tomorrow'), departmentName (optional), titleKeywords (optional)
// ---------------------------------------------------------------------------
async function cancelMeetingFn({ date, titleKeywords, departmentName } = {}) {
  const IST = "Asia/Kolkata";
  const nowISTStr = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  let dateStr = date || nowISTStr;

  if (date === "today") {
    dateStr = nowISTStr;
  } else if (date === "tomorrow") {
    const tomorrowIST = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
    dateStr = tomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
  } else if (date) {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      dateStr = parsed.toLocaleDateString("en-CA", { timeZone: IST });
    }
  }

  // Fetch all meetings starting from that day boundaries in IST
  const dayStartIST = new Date(`${dateStr}T00:00:00+05:30`);
  const dayEndIST = new Date(`${dateStr}T23:59:59+05:30`);

  const dbMeetings = await listMeetings(dayStartIST.toISOString());
  
  // Filter meetings to this specific date in IST and match keywords/dept
  const matching = dbMeetings.filter(m => {
    const mDateIST = new Date(m.scheduleDateTime).toLocaleDateString("en-CA", { timeZone: IST });
    if (mDateIST !== dateStr) return false;

    // Optional Title match
    if (titleKeywords) {
      const titleLower = m.title.toLowerCase();
      const kwLower = titleKeywords.toLowerCase();
      if (!titleLower.includes(kwLower)) return false;
    }

    // Optional Department match
    if (departmentName) {
      const deptLower = departmentName.toLowerCase();
      if (m.title.toLowerCase().includes(deptLower)) return true;
    }

    return true;
  });

  if (matching.length === 0) {
    return `I couldn't find any scheduled meetings on ${dateStr} matching those details.`;
  }

  if (matching.length > 1) {
    const names = matching
      .map(
        (m, i) =>
          `${i + 1}. "${m.title}" at ${new Date(m.scheduleDateTime).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: IST,
          })}`
      )
      .join(", ");
    return `I found multiple meetings on that day: ${names}. Which one would you like to cancel? Please specify the exact title.`;
  }

  // Exact match found! Delete it.
  const target = matching[0];
  try {
    await deleteMeeting(target.id);
    const timeFormatted = new Date(target.scheduleDateTime).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: IST,
    });
    return `Successfully cancelled the meeting "${target.title}" scheduled for ${timeFormatted}.`;
  } catch (err) {
    console.error("[Vapi cancelMeeting error]:", err);
    return `I encountered an error cancelling the meeting: ${err.message}`;
  }
}

