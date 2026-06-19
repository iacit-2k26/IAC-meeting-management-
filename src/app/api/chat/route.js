import { NextResponse } from "next/server";
import { listDepartments, listEmployees, createMeeting, listMeetings, getZoomHostEmployee, getEmployeesByDepartment, deleteMeeting } from "@/lib/repository";
import { listCalendarEvents, checkFreeBusy } from "@/lib/googleCalendar";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

const IST = "Asia/Kolkata";

// ---------------------------------------------------------------------------
// Helper functions (copied from Vapi route)
// ---------------------------------------------------------------------------
async function checkCalendarFn({ date } = {}) {
  // Get current date-string in IST (YYYY-MM-DD)
  const nowISTStr = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  const [nowY, nowM, nowD] = nowISTStr.split("-").map(Number);

  let dateStr; // YYYY-MM-DD in IST

  if (!date || date.toLowerCase() === "today") {
    dateStr = nowISTStr;
  } else if (date.toLowerCase() === "tomorrow") {
    const tomorrowIST = new Date(nowY, nowM - 1, nowD + 1);
    dateStr = tomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
  } else if (date.toLowerCase() === "day after tomorrow" || date.toLowerCase() === "day after tommorow") {
    const dayAfterTomorrowIST = new Date(nowY, nowM - 1, nowD + 2);
    dateStr = dayAfterTomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
  } else {
    // User said a specific date — parse as IST date
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return "Sorry, I didn't catch that date. Try 'today', 'tomorrow', or something like 'June 20th'?";
    }
    dateStr = parsed.toLocaleDateString("en-CA", { timeZone: IST });
  }

  // Build IST day boundaries as ISO strings so Google Calendar API gets the right window
  const dayStartIST = new Date(`${dateStr}T00:00:00+05:30`); // midnight IST
  const dayEndIST = new Date(`${dateStr}T23:59:59+05:30`); // 11:59:59 PM IST

  // Human-readable label ("Monday, 15 June 2026")
  const dateLabel = dayStartIST.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: IST,
  });

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
    return `Nice! Nothing scheduled for ${dateLabel}.`;
  }

  const meetingList = allEvents
    .map(
      (ev, i) =>
        `- "${ev.title}" at ${ev.time}${ev.source === "calendar" ? " (Google Calendar)" : ""}`
    )
    .join("\n");

  return `Here's what's on for ${dateLabel}:\n${meetingList}`;
}

async function getDepartmentEmployeesFn({ departmentName } = {}) {
  if (!departmentName) {
    return "Which department should I check?";
  }

  const { department, employees } = await getEmployeesByDepartment(departmentName);

  if (!department) {
    const allDepts = await listDepartments();
    const names = allDepts.map((d) => d.name).join(", ");
    return `Sorry, I don't see a department called "${departmentName}". Available departments: ${names}`;
  }

  if (employees.length === 0) {
    return `The ${department.name} department doesn't have any active employees right now.`;
  }

  const names = employees
    .map((e) => `${e.firstName} ${e.lastName} (${e.designation || "Employee"})`)
    .join(", ");

  return `Okay, ${department.name} has ${employees.length} active employee${employees.length > 1 ? "s" : ""}: ${names}. Want to create a meeting for all of them?`;
}

async function createMeetingFn({
  departmentName,
  title,
  meetingType = "",
  time,
  duration = 30,
  agenda,
  location = "",
  isVirtual = true,
  externalAttendees = [],
  hostName = "",
} = {}) {
  // Validation
  if (!departmentName) {
    return "Which department is this for?";
  }
  if (!title) {
    return "What should the meeting title be?";
  }
  if (!agenda) {
    return "What's the meeting agenda?";
  }
  if (!time) {
    return "When should we schedule this meeting?";
  }

  const scheduleDateTime = new Date(time);
  if (isNaN(scheduleDateTime.getTime())) {
    return `Sorry, I didn't understand "${time}". Can you try something like "tomorrow at 3 PM" or "June 20th at 10 AM"?`;
  }

  // Fetch department + its employees
  const { department, employees } = await getEmployeesByDepartment(departmentName);

  if (!department) {
    const allDepts = await listDepartments();
    const names = allDepts.map((d) => d.name).join(", ");
    return `Sorry, I don't see a department called "${departmentName}". Available departments: ${names}`;
  }

  if (employees.length === 0) {
    return `The ${department.name} department doesn't have any active employees. Can't create a meeting without attendees!`;
  }

  // Resolve Zoom account owner as the default host
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
    }
  }

  // Add host and department members to the attendee IDs
  const deptEmpIds = new Set(employees.map((e) => e.id));
  const allAttendeeIds = [...deptEmpIds];
  if (hostEmployee && !deptEmpIds.has(hostEmployee.id)) {
    allAttendeeIds.push(hostEmployee.id);
  }

  // Create the meeting
  try {
    const meeting = await createMeeting({
      title,
      meetingType,
      agenda,
      scheduleDateTime: scheduleDateTime.toISOString(),
      duration: parseInt(duration) || 30,
      location,
      isVirtual: Boolean(isVirtual),
      hostId: hostEmployee.id,
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
    const locationInfo = !isVirtual && location ? ` In-person location: ${location}` : "";

    return (
      `Done! Scheduled "${title}"${meetingType ? ` (${meetingType})` : ""} for ${department.name} on ${formattedTime} (${duration || 30} mins). Hosted by ${actualHostName}.${locationInfo} I've sent a Google Calendar invite with the Zoom link to everyone.`
    );
  } catch (error) {
    console.error("[Chat createMeeting error]:", error);
    return `Oops, couldn't create the meeting: ${error.message}`;
  }
}

async function listDepartmentsFn() {
  const departments = await listDepartments();
  if (departments.length === 0) return "No departments in the system yet.";
  const names = departments.map((d) => d.name).join(", ");
  return `Okay, here are the departments: ${names}`;
}

async function listEmployeesFn() {
  const employees = await listEmployees();
  if (employees.length === 0) return "No employees in the system yet.";
  const names = employees
    .map((e) => `${e.firstName} ${e.lastName}`)
    .join(", ");
  return `Okay, here are all employees: ${names}`;
}

async function cancelMeetingFn({ date, titleKeywords, departmentName } = {}) {
  const nowISTStr = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  const [nowY, nowM, nowD] = nowISTStr.split("-").map(Number);
  let dateStr = date || nowISTStr;

  if (date?.toLowerCase() === "today") {
    dateStr = nowISTStr;
  } else if (date?.toLowerCase() === "tomorrow") {
    const tomorrowIST = new Date(nowY, nowM - 1, nowD + 1);
    dateStr = tomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
  } else if (date?.toLowerCase() === "day after tomorrow" || date?.toLowerCase() === "day after tommorow") {
    const dayAfterTomorrowIST = new Date(nowY, nowM - 1, nowD + 2);
    dateStr = dayAfterTomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
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
    return `Sorry, no meetings found on ${dateStr} matching those details.`;
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
    return `I found multiple meetings on that day: ${names}. Which one should I cancel?`;
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
    return `Okay, cancelled "${target.title}" at ${timeFormatted}.`;
  } catch (err) {
    console.error("[Chat cancelMeeting error]:", err);
    return `Oops, couldn't cancel the meeting: ${err.message}`;
  }
}

async function checkAvailabilityFn({
  employeeNames = [],
  time,
  duration = 30,
} = {}) {
  if (employeeNames.length === 0) {
    return "Which employees should I check?";
  }
  if (!time) {
    return "What time should I check?";
  }

  const startTime = new Date(time);
  if (isNaN(startTime.getTime())) {
    return `Sorry, I didn't understand "${time}". Try something like "tomorrow at 3 PM".`;
  }

  const endTime = new Date(startTime.getTime() + parseInt(duration) * 60 * 1000);
  const allEmployees = await listEmployees();

  // Find employees by name
  const matchedEmployees = allEmployees.filter((emp) => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    return employeeNames.some((name) => fullName.includes(name.toLowerCase()));
  });

  if (matchedEmployees.length === 0) {
    return `Sorry, I couldn't find employees named "${employeeNames.join(", ")}".`;
  }

  // Use email as calendar ID (for Google Workspace)
  const calendarIds = matchedEmployees.map((emp) => emp.email);

  // Check free/busy
  const freeBusy = await checkFreeBusy(
    startTime.toISOString(),
    endTime.toISOString(),
    calendarIds
  );

  // Check who is busy
  const busyEmployees = [];
  const freeEmployees = [];

  matchedEmployees.forEach((emp) => {
    const calendarData = freeBusy.calendars?.[emp.email];
    if (calendarData?.busy?.length > 0) {
      busyEmployees.push(`${emp.firstName} ${emp.lastName}`);
    } else {
      freeEmployees.push(`${emp.firstName} ${emp.lastName}`);
    }
  });

  const timeStr = startTime.toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });

  let message = `Checking availability for ${timeStr} (${duration} min):\n`;

  if (freeEmployees.length > 0) {
    message += `✅ Free: ${freeEmployees.join(", ")}\n`;
  }
  if (busyEmployees.length > 0) {
    message += `❌ Busy: ${busyEmployees.join(", ")}`;
  }

  return message;
}

async function findMutualTimeFn({
  employeeNames = [],
  date,
  duration = 30,
} = {}) {
  if (employeeNames.length === 0) {
    return "Which employees should I find time for?";
  }

  const nowISTStr = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  const [nowY, nowM, nowD] = nowISTStr.split("-").map(Number);

  let targetDate;

  if (!date || date.toLowerCase() === "today") {
    targetDate = nowISTStr;
  } else if (date.toLowerCase() === "tomorrow") {
    const tomorrowIST = new Date(nowY, nowM - 1, nowD + 1);
    targetDate = tomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
  } else if (date.toLowerCase() === "day after tomorrow" || date.toLowerCase() === "day after tommorow") {
    const dayAfterTomorrowIST = new Date(nowY, nowM - 1, nowD + 2);
    targetDate = dayAfterTomorrowIST.toLocaleDateString("en-CA", { timeZone: IST });
  } else {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed.toLocaleDateString("en-CA", { timeZone: IST });
    } else {
      return "Sorry, I didn't understand that date. Try 'today', 'tomorrow', or 'June 20th'.";
    }
  }

  // Set time range: 9:30 AM to 6:30 PM IST (working hours)
  const timeMin = new Date(`${targetDate}T09:30:00+05:30`);
  const timeMax = new Date(`${targetDate}T18:30:00+05:30`);

  const allEmployees = await listEmployees();
  const matchedEmployees = allEmployees.filter((emp) => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    return employeeNames.some((name) => fullName.includes(name.toLowerCase()));
  });

  if (matchedEmployees.length === 0) {
    return `Sorry, I couldn't find employees named "${employeeNames.join(", ")}".`;
  }

  const calendarIds = matchedEmployees.map((emp) => emp.email);
  const freeBusy = await checkFreeBusy(
    timeMin.toISOString(),
    timeMax.toISOString(),
    calendarIds
  );

  // Collect all busy intervals for everyone
  const allBusy = [];
  matchedEmployees.forEach((emp) => {
    const busy = freeBusy.calendars?.[emp.email]?.busy || [];
    allBusy.push(...busy);
  });

  // First, find all 30-min free slots
  const allFreeSlots = [];
  let currentTime = new Date(timeMin);

  while (currentTime < timeMax) {
    const slotEnd = new Date(currentTime.getTime() + 30 * 60 * 1000);
    if (slotEnd > timeMax) break;

    // Check if this 30-min slot is completely free
    const isSlotBusy = allBusy.some((busy) => {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return currentTime < busyEnd && slotEnd > busyStart;
    });

    if (!isSlotBusy) {
      allFreeSlots.push({ start: new Date(currentTime), end: slotEnd });
    }

    currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
  }

  // Now merge consecutive free slots into larger blocks
  const mergedSlots = [];
  if (allFreeSlots.length > 0) {
    let currentBlock = { ...allFreeSlots[0] };
    
    for (let i = 1; i < allFreeSlots.length; i++) {
      const slot = allFreeSlots[i];
      // If this slot starts right after the current block ends, merge them
      if (slot.start.getTime() === currentBlock.end.getTime()) {
        currentBlock.end = slot.end;
      } else {
        // Otherwise, save the current block and start a new one
        mergedSlots.push({ ...currentBlock });
        currentBlock = { ...slot };
      }
    }
    // Push the last block
    mergedSlots.push({ ...currentBlock });
  }

  // Now filter merged blocks to find ones that are at least the requested duration
  const validSlots = mergedSlots.filter(block => {
    const blockDurationMs = block.end.getTime() - block.start.getTime();
    return blockDurationMs >= parseInt(duration) * 60 * 1000;
  });

  const dateLabel = timeMin.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: IST,
  });

  if (validSlots.length === 0) {
    return `Sorry, couldn't find mutual free time for ${matchedEmployees.map(e => `${e.firstName} ${e.lastName}`).join(", ")} on ${dateLabel}. Try another date or shorter duration!`;
  }

  // Format the valid slots (show the whole merged block, not just the requested duration)
  const formattedSlots = validSlots.slice(0, 5).map((block) => {
    return `${block.start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST })} - ${block.end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST })}`;
  });

  return `Found ${validSlots.length} mutual free time slots on ${dateLabel} for ${matchedEmployees.map(e => `${e.firstName} ${e.lastName}`).join(", ")}:\n${formattedSlots.join("\n")}`;
}

// Dispatch function
async function dispatchFunction(name, params) {
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

    case "checkAvailability":
      return checkAvailabilityFn(params);

    case "findMutualTime":
      return findMutualTimeFn(params);

    default:
      return `Unknown function: "${name}". Available functions: checkCalendar, getDepartmentEmployees, createMeeting, listDepartments, listEmployees, checkAvailability, findMutualTime.`;
  }
}

export async function POST(request) {
  try {
    const { message, sessionData } = await request.json();
    if (!message) throw new Error("Message is required");

    // Get current date in IST
    const nowIST = new Date().toLocaleString("en-CA", { timeZone: IST });
    
    // Define the tools/functions available
    const tools = [
      {
        type: "function",
        function: {
          name: "checkCalendar",
          description: "Check the calendar (system meetings and Google Calendar events for a specific date. Use 'today' or 'tomorrow' or a specific date string.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "The date to check (optional, defaults to today if not provided)" },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getDepartmentEmployees",
          description: "List all active employees in a specific department.",
          parameters: {
            type: "object",
            properties: {
              departmentName: { type: "string", description: "Name of the department" },
            },
            required: ["departmentName"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "createMeeting",
          description: "Create a new meeting with Zoom and Google Calendar integration.",
          parameters: {
            type: "object",
            properties: {
              departmentName: { type: "string" },
              title: { type: "string" },
              meetingType: { type: "string", description: "Optional type of meeting (e.g., Review, Brainstorming)" },
              time: { type: "string", description: "Date and time of the meeting (ISO string or natural language like 'tomorrow at 3pm')" },
              duration: { type: "number", description: "Duration in minutes, defaults to 30" },
              agenda: { type: "string" },
              location: { type: "string" },
              isVirtual: { type: "boolean" },
              externalAttendees: { 
            type: "array", 
            items: { 
              type: "object", 
              properties: { 
                name: { type: "string" }, 
                email: { type: "string" } 
              },
              additionalProperties: false
            } 
          },
              hostName: { type: "string", description: "Optional name of the meeting host" },
            },
            required: ["departmentName", "title", "time", "agenda"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "listDepartments",
          description: "List all available departments in the company.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "listEmployees",
          description: "List all active employees in the company.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: "checkAvailability",
          description: "Check if specific employees are available at a certain time.",
          parameters: {
            type: "object",
            properties: {
              employeeNames: { type: "array", items: { type: "string" } },
              time: { type: "string" },
              duration: { type: "number", description: "Duration in minutes, defaults to 30" },
            },
            required: ["employeeNames", "time"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "findMutualTime",
          description: "Find overlapping free time slots for multiple employees.",
          parameters: {
            type: "object",
            properties: {
              employeeNames: { type: "array", items: { type: "string" } },
              date: { type: "string", description: "Date to check (optional, defaults to today if not provided)" },
              duration: { type: "number", description: "Duration in minutes, defaults to 30" },
            },
            required: ["employeeNames"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "cancelMeeting",
          description: "Cancel a scheduled meeting.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string" },
              titleKeywords: { type: "string" },
              departmentName: { type: "string" },
            },
            required: [],
          },
        },
      },
    ];

    // System prompt for the AI
    const systemPrompt = `You're a friendly, efficient meeting assistant for "IAC Meeting Central".
Timezone: Asia/Kolkata (IST) | Current date/time: ${nowIST}

Quick rules:
- Keep responses super casual, like chatting with a colleague
- Use tools only when needed, and don't make a big deal out of it
- If you need info, ask clearly—one question at a time
- When you get tool results, rephrase them in your own words (don't just copy-paste)
- Use "today", "tomorrow", "day after tomorrow" for dates
- Keep it short and sweet`;

    let aiResponseText = "";
    let meetingResult = null;

    // Use Groq
    if (process.env.GROQ_API_KEY) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            ...(sessionData?.messages || []),
            { role: "user", content: message },
          ],
          model: "llama-3.1-8b-instant",
          tools: tools,
          tool_choice: "auto",
        });

        const assistantMessage = chatCompletion.choices[0].message;
        let newMessages = [
          { role: "system", content: systemPrompt },
          ...(sessionData?.messages || []),
          { role: "user", content: message },
        ];

        // If the AI wants to call a tool
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          newMessages.push(assistantMessage);
          
          for (const toolCall of assistantMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            console.log(`Calling function: ${functionName} with args:`, functionArgs);
            
            const toolResult = await dispatchFunction(functionName, functionArgs);
            aiResponseText = toolResult;

            // Add tool response to message history
            newMessages.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: functionName,
              content: toolResult,
            });

            // If it's a createMeeting result, set meetingResult
            if (functionName === "createMeeting" && toolResult.includes("Done!")) {
              meetingResult = true;
            }
          }
        } else {
          aiResponseText = assistantMessage.content || "How can I help you today?";
        }
      } catch (aiError) {
        console.error("Groq AI Error:", aiError);
      }
    }

    // Default response if no AI worked
    if (!aiResponseText) {
      aiResponseText = "I'm here to help you manage your meetings. What would you like to do?";
    }

    // Update session data with message history (exclude system prompt since we add it fresh each time)
    const updatedSessionData = {
      ...sessionData,
      messages: [
        ...(sessionData?.messages || []),
        { role: "user", content: message },
        { role: "assistant", content: aiResponseText },
      ],
    };

    return NextResponse.json({
      answer: aiResponseText,
      meeting: meetingResult,
      sessionData: updatedSessionData,
    });
  } catch (error) {
    console.error("[Chat API Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 400 });
  }
}
