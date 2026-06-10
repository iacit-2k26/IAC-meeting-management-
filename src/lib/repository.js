import { getDatabase } from "@/lib/mongodb";
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting } from "@/lib/zoom";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, listCalendarEvents } from "@/lib/googleCalendar";

async function getCollection(collectionName) {
  const db = await getDatabase();
  return db.collection(collectionName);
}

function buildId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function dedupe(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeEmployeePayload(payload = {}) {
  return {
    employeeId: String(payload.employeeId || "").trim(),
    firstName: String(payload.firstName || "").trim(),
    lastName: String(payload.lastName || "").trim(),
    email: String(payload.email || "").trim().toLowerCase(),
    designation: String(payload.designation || "").trim(),
    departmentId: String(payload.departmentId || "").trim(),
    reportingTo: String(payload.reportingTo || "").trim(),
    status: String(payload.status || "active").trim(),
  };
}

function normalizeDepartmentPayload(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    head: String(payload.head || "").trim(),
    status: String(payload.status || "active").trim(),
    description: String(payload.description || "").trim(),
  };
}

function normalizeExternalAttendees(externalAttendees = []) {
  return (externalAttendees || [])
    .map((attendee) => ({
      name: String(attendee?.name || "").trim(),
      email: String(attendee?.email || "").trim().toLowerCase(),
      status: String(attendee?.status || "invited").trim(),
    }))
    .filter((attendee) => attendee.name && attendee.email);
}

function normalizeMeetingPayload(payload = {}) {
  return {
    title: String(payload.title || "").trim(),
    meetingType: String(payload.meetingType || "").trim(),
    agenda: String(payload.agenda || "").trim(),
    scheduleDateTime: String(payload.scheduleDateTime || "").trim(),
    duration: Number(payload.duration || 0),
    hostId: String(payload.hostId || "").trim(),
    departmentIds: dedupe((payload.departmentIds || []).map(String)),
    internalAttendeeIds: dedupe((payload.internalAttendeeIds || []).map(String)),
    externalAttendees: normalizeExternalAttendees(payload.externalAttendees),
    location: String(payload.location || "").trim(),
    isVirtual: payload.isVirtual !== undefined ? Boolean(payload.isVirtual) : true,
    zoomMeetingId: String(payload.zoomMeetingId || "").trim(),
    zoomJoinUrl: String(payload.zoomJoinUrl || "").trim(),
    zoomPassword: String(payload.zoomPassword || "").trim(),
    // Google Calendar event ID — stored so we can update/delete later
    googleEventId: String(payload.googleEventId || "").trim(),
  };
}

// Build the display title used in Zoom & Google Calendar:
// "Meeting Title – Meeting Type" when a type is selected, otherwise just the title.
// Prevents duplication if the meetingType is already present in the title.
function composeMeetingTitle(title, meetingType) {
  if (!meetingType) return title;
  
  const normalizedTitle = title.toLowerCase();
  const normalizedType = meetingType.toLowerCase();

  // If title already contains the meeting type, just return the title
  if (normalizedTitle.includes(normalizedType)) {
    return title;
  }
  
  return `${title} – ${meetingType}`;
}

function validateEmployeePayload(payload) {
  if (!payload.employeeId || !payload.firstName || !payload.lastName || !payload.email) {
    throw new Error("Employee ID, first name, last name, and email are required.");
  }
}

function validateDepartmentPayload(payload) {
  if (!payload.name) {
    throw new Error("Department name is required.");
  }
}

function validateMeetingPayload(payload) {
  if (!payload.title || !payload.hostId || !payload.scheduleDateTime || !payload.duration) {
    throw new Error("Meeting title, host, schedule, and duration are required.");
  }
}

async function collectAttendeeDetails(internalAttendeeIds, externalAttendees) {
  const employeesCollection = await getCollection("employees");
  const internalAttendees = await employeesCollection
    .find({ id: { $in: internalAttendeeIds } })
    .toArray();

  const details = [
    ...internalAttendees.map((emp) => ({
      email: emp.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
    })),
    ...externalAttendees.map((ext) => ({
      email: ext.email,
      name: ext.name,
    })),
  ];

  return details;
}

export async function listEmployees() {
  const collection = await getCollection("employees");
  return collection.find({}).toArray();
}

export async function getEmployee(employeeId) {
  const collection = await getCollection("employees");
  return collection.findOne({ id: employeeId });
}

export async function createEmployee(payload) {
  const collection = await getCollection("employees");
  const departments = await listDepartments();
  const normalizedPayload = normalizeEmployeePayload(payload);

  validateEmployeePayload(normalizedPayload);

  if (!departments.some((department) => department.id === normalizedPayload.departmentId)) {
    throw new Error("Selected department does not exist.");
  }

  if (await collection.findOne({ employeeId: normalizedPayload.employeeId })) {
    throw new Error("Employee ID must be unique.");
  }

  if (await collection.findOne({ email: normalizedPayload.email })) {
    throw new Error("Employee email must be unique.");
  }

  const nextEmployee = {
    id: buildId("emp"),
    ...normalizedPayload,
  };

  await collection.insertOne({ ...nextEmployee, _id: nextEmployee.id });
  return nextEmployee;
}

export async function updateEmployee(employeeId, payload) {
  const collection = await getCollection("employees");
  const departments = await listDepartments();
  const employee = await collection.findOne({ id: employeeId });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const normalizedPayload = normalizeEmployeePayload({
    ...employee,
    ...payload,
  });

  validateEmployeePayload(normalizedPayload);

  if (!departments.some((department) => department.id === normalizedPayload.departmentId)) {
    throw new Error("Selected department does not exist.");
  }

  if (await collection.findOne({ id: { $ne: employeeId }, employeeId: normalizedPayload.employeeId })) {
    throw new Error("Employee ID must be unique.");
  }

  if (await collection.findOne({ id: { $ne: employeeId }, email: normalizedPayload.email })) {
    throw new Error("Employee email must be unique.");
  }

  const updatedEmployee = {
    ...employee,
    ...normalizedPayload,
  };

  await collection.updateOne({ id: employeeId }, { $set: normalizedPayload });
  return updatedEmployee;
}

export async function deleteEmployee(employeeId) {
  const collection = await getCollection("employees");
  const meetingsCollection = await getCollection("meetings");

  if (await meetingsCollection.findOne({ hostId: employeeId })) {
    throw new Error("This employee is assigned as a host on one or more meetings.");
  }

  const result = await collection.deleteOne({ id: employeeId });

  if (result.deletedCount === 0) {
    throw new Error("Employee not found.");
  }

  await meetingsCollection.updateMany(
    {},
    { $pull: { internalAttendeeIds: employeeId } }
  );
}

export async function listDepartments() {
  const collection = await getCollection("departments");
  return collection.find({}).toArray();
}

export async function getDepartment(departmentId) {
  const collection = await getCollection("departments");
  return collection.findOne({ id: departmentId });
}

export async function createDepartment(payload) {
  const collection = await getCollection("departments");
  const normalizedPayload = normalizeDepartmentPayload(payload);

  validateDepartmentPayload(normalizedPayload);

  const nextDepartment = {
    id: buildId("dep"),
    ...normalizedPayload,
  };

  await collection.insertOne({ ...nextDepartment, _id: nextDepartment.id });
  return nextDepartment;
}

export async function updateDepartment(departmentId, payload) {
  const collection = await getCollection("departments");
  const department = await collection.findOne({ id: departmentId });

  if (!department) {
    throw new Error("Department not found.");
  }

  const normalizedPayload = normalizeDepartmentPayload({
    ...department,
    ...payload,
  });

  validateDepartmentPayload(normalizedPayload);

  const updatedDepartment = {
    ...department,
    ...normalizedPayload,
  };

  await collection.updateOne({ id: departmentId }, { $set: normalizedPayload });
  return updatedDepartment;
}

export async function deleteDepartment(departmentId) {
  const collection = await getCollection("departments");
  const employeesCollection = await getCollection("employees");
  const meetingsCollection = await getCollection("meetings");

  if (await employeesCollection.findOne({ departmentId: departmentId })) {
    throw new Error("Cannot delete a department with linked employees.");
  }

  if (await meetingsCollection.findOne({ departmentIds: departmentId })) {
    throw new Error("Cannot delete a department linked to meetings.");
  }

  const result = await collection.deleteOne({ id: departmentId });

  if (result.deletedCount === 0) {
    throw new Error("Department not found.");
  }
}

export async function listMeetings(baseDate = null) {
  const collection = await getCollection("meetings");
  const employeesCollection = await getCollection("employees");
  const [dbMeetings, allEmployees] = await Promise.all([
    collection.find({}).toArray(),
    employeesCollection.find({}).toArray(),
  ]);

  const internalEmails = new Set(allEmployees.map(emp => emp.email.toLowerCase()));

  // Fetch Google Calendar events based on baseDate or current time
  const referenceDate = baseDate ? new Date(baseDate) : new Date();
  
  const timeMin = new Date(referenceDate);
  timeMin.setDate(timeMin.getDate() - 7);
  timeMin.setHours(0, 0, 0, 0);
  
  const timeMax = new Date(referenceDate);
  timeMax.setDate(timeMax.getDate() + 90);
  timeMax.setHours(23, 59, 59, 999);

  const calendarEvents = await listCalendarEvents(timeMin.toISOString(), timeMax.toISOString());
  const calendarEventMap = new Map(calendarEvents.map(event => [event.id, event]));

  // Filter DB meetings for the same range and sync attendees from Google Calendar if linked
  const dbGoogleEventIds = new Set();
  const mergedMeetings = dbMeetings
    .filter(m => {
      const d = new Date(m.scheduleDateTime);
      const isInRange = d >= timeMin && d <= timeMax;
      if (isInRange && m.googleEventId) {
        dbGoogleEventIds.add(m.googleEventId);
      }
      return isInRange;
    })
    .map(m => {
      // Compute status dynamically from scheduleDateTime + duration
      const startTime = m.scheduleDateTime;
      const endTime = new Date(new Date(startTime).getTime() + (m.duration || 0) * 60000).toISOString();
      const computedStatus = getMeetingStatus(startTime, endTime);

      // If meeting is linked to Google Calendar, sync the attendees list
      if (m.googleEventId && calendarEventMap.has(m.googleEventId)) {
        const event = calendarEventMap.get(m.googleEventId);
        const gcalAttendees = (event.attendees || [])
          .map((a) => ({
            name: a.displayName || a.email,
            email: a.email,
            status: a.responseStatus === "accepted" ? "accepted" : a.responseStatus || "invited",
          }))
          // Filter out internal employees from the external attendees list
          .filter(a => !internalEmails.has(a.email.toLowerCase()));

        // Merge attendees: keep internal ones from DB, but update external ones from Google Calendar
        // Google Calendar is the source of truth for participant list and status
        const internalStatuses = {};
        (event.attendees || []).forEach(a => {
          if (internalEmails.has(a.email.toLowerCase())) {
            // Find which internal employee this is
            const emp = allEmployees.find(e => e.email.toLowerCase() === a.email.toLowerCase());
            if (emp) {
              internalStatuses[emp.id] = a.responseStatus === "accepted" ? "accepted" : a.responseStatus || "invited";
            }
          }
        });

        return {
          ...m,
          status: computedStatus,
          externalAttendees: gcalAttendees,
          internalAttendeeStatuses: internalStatuses,
        };
      }
      return { ...m, status: computedStatus };
    });

  for (const event of calendarEvents) {
    if (event.status === "cancelled") continue;

    if (!dbGoogleEventIds.has(event.id)) {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;

      const internalAttendeeIds = [];
      const internalStatuses = {};
      const externalAttendees = [];

      (event.attendees || []).forEach((a) => {
        const email = a.email.toLowerCase();
        const status = a.responseStatus === "accepted" ? "accepted" : a.responseStatus || "invited";
        
        if (internalEmails.has(email)) {
          const emp = allEmployees.find(e => e.email.toLowerCase() === email);
          if (emp) {
            internalAttendeeIds.push(emp.id);
            internalStatuses[emp.id] = status;
          }
        } else {
          externalAttendees.push({
            name: a.displayName || a.email,
            email: a.email,
            status: status,
          });
        }
      });

      mergedMeetings.push({
        id: `gcal-${event.id}`,
        title: event.summary || "(No title)",
        agenda: event.description || "",
        scheduleDateTime: startTime,
        duration: endTime ? Math.round((new Date(endTime) - new Date(startTime)) / 60000) : 0,
        hostId: "external",
        departmentIds: [],
        internalAttendeeIds,
        internalAttendeeStatuses: internalStatuses,
        externalAttendees,
        status: getMeetingStatus(startTime, endTime),
        googleEventId: event.id,
        isVirtual: true,
      });
    }
  }

  // Sort meetings by date (newest first for dashboard, but usually ascending is better for registry)
  return mergedMeetings.sort((a, b) => new Date(a.scheduleDateTime) - new Date(b.scheduleDateTime));
}

export async function getMeeting(meetingId) {
  const collection = await getCollection("meetings");
  const meeting = await collection.findOne({ id: meetingId });
  if (!meeting) return null;
  const startTime = meeting.scheduleDateTime;
  const endTime = new Date(new Date(startTime).getTime() + (meeting.duration || 0) * 60000).toISOString();
  return { ...meeting, status: getMeetingStatus(startTime, endTime) };
}

export async function createMeeting(payload) {
  const collection = await getCollection("meetings");
  const departmentsCollection = await getCollection("departments");
  const employeesCollection = await getCollection("employees");
  const normalizedPayload = normalizeMeetingPayload(payload);

  validateMeetingPayload(normalizedPayload);

  if (!(await employeesCollection.findOne({ id: normalizedPayload.hostId }))) {
    throw new Error("Selected meeting host does not exist.");
  }

  for (const departmentId of normalizedPayload.departmentIds) {
    if (!(await departmentsCollection.findOne({ id: departmentId }))) {
      throw new Error("One or more selected departments do not exist.");
    }
  }

  for (const attendeeId of normalizedPayload.internalAttendeeIds) {
    if (!(await employeesCollection.findOne({ id: attendeeId }))) {
      throw new Error("One or more internal attendees do not exist.");
    }
  }

  const zoomMeeting = await createZoomMeeting({
    topic: composeMeetingTitle(normalizedPayload.title, normalizedPayload.meetingType),
    agenda: normalizedPayload.agenda,
    startTime: normalizedPayload.scheduleDateTime,
    duration: normalizedPayload.duration,
  });

  // Collect all attendee details (internal employees + external guests)
  const attendees = await collectAttendeeDetails(
    normalizedPayload.internalAttendeeIds,
    normalizedPayload.externalAttendees
  );

  // Build the partial meeting object needed for emails/calendar before DB insert
  const partialMeeting = {
    ...normalizedPayload,
    // Use composed title for calendar/email display
    _composedTitle: composeMeetingTitle(normalizedPayload.title, normalizedPayload.meetingType),
    zoomMeetingId: zoomMeeting.id,
    zoomJoinUrl: zoomMeeting.joinUrl,
    zoomPassword: zoomMeeting.password,
  };

  // Create Google Calendar event — sends invites to all attendees' Google Calendars
  const googleEventId = await createCalendarEvent(partialMeeting, attendees);

  const nextMeeting = {
    id: buildId("mtg"),
    ...partialMeeting,
    googleEventId: googleEventId || "",
  };

  await collection.insertOne({ ...nextMeeting, _id: nextMeeting.id });

  return nextMeeting;
}

export async function updateMeeting(meetingId, payload) {
  const collection = await getCollection("meetings");
  const departmentsCollection = await getCollection("departments");
  const employeesCollection = await getCollection("employees");
  const meeting = await collection.findOne({ id: meetingId });

  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  const normalizedPayload = normalizeMeetingPayload({
    ...meeting,
    ...payload,
  });

  validateMeetingPayload(normalizedPayload);

  if (!(await employeesCollection.findOne({ id: normalizedPayload.hostId }))) {
    throw new Error("Selected meeting host does not exist.");
  }

  for (const departmentId of normalizedPayload.departmentIds) {
    if (!(await departmentsCollection.findOne({ id: departmentId }))) {
      throw new Error("One or more selected departments do not exist.");
    }
  }

  for (const attendeeId of normalizedPayload.internalAttendeeIds) {
    if (!(await employeesCollection.findOne({ id: attendeeId }))) {
      throw new Error("One or more internal attendees do not exist.");
    }
  }

  if (meeting.zoomMeetingId) {
    await updateZoomMeeting(meeting.zoomMeetingId, {
      topic: composeMeetingTitle(normalizedPayload.title, normalizedPayload.meetingType),
      agenda: normalizedPayload.agenda,
      startTime: normalizedPayload.scheduleDateTime,
      duration: normalizedPayload.duration,
    });
  }

  // Collect updated attendee list
  const attendees = await collectAttendeeDetails(
    normalizedPayload.internalAttendeeIds,
    normalizedPayload.externalAttendees
  );

  // Build the updated meeting object for calendar/email (includes zoom fields)
  const updatedPartial = {
    ...meeting,
    ...normalizedPayload,
    _composedTitle: composeMeetingTitle(normalizedPayload.title, normalizedPayload.meetingType),
  };

  // Update the Google Calendar event and re-send invites to all attendees
  const updatedGoogleEventId = await updateCalendarEvent(
    meeting.googleEventId || null,
    updatedPartial,
    attendees
  );

  const updatedMeeting = {
    ...updatedPartial,
    googleEventId: updatedGoogleEventId || meeting.googleEventId || "",
  };

  // Persist update (include googleEventId in case it changed)
  await collection.updateOne(
    { id: meetingId },
    { $set: { ...normalizedPayload, googleEventId: updatedMeeting.googleEventId } }
  );

  return updatedMeeting;
}

export async function deleteMeeting(meetingId) {
  const collection = await getCollection("meetings");
  const meeting = await collection.findOne({ id: meetingId });

  if (!meeting) {
    throw new Error("Meeting not found.");
  }

  // Collect all attendees so we can send cancellation emails
  const attendees = await collectAttendeeDetails(
    meeting.internalAttendeeIds || [],
    meeting.externalAttendees || []
  );

  // Delete Zoom meeting
  if (meeting.zoomMeetingId) {
    await deleteZoomMeeting(meeting.zoomMeetingId);
  }

  // Delete Google Calendar event (notifies attendees of cancellation)
  if (meeting.googleEventId) {
    await deleteCalendarEvent(meeting.googleEventId);
  }

  const result = await collection.deleteOne({ id: meetingId });

  if (result.deletedCount === 0) {
    throw new Error("Meeting not found.");
  }
}

function getMeetingStatus(startTime, endTime) {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (now >= start && now <= end) {
    return "ongoing";
  } else if (now < start) {
    return "upcoming";
  } else {
    return "completed";
  }
}

export async function getDashboardData() {
  const [employees, departments, meetings] = await Promise.all([
    listEmployees(),
    listDepartments(),
    listMeetings(),
  ]);

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA"); // YYYY-MM-DD

  const todayMeetings = meetings.filter(m => {
    const meetingDate = new Date(m.scheduleDateTime).toLocaleDateString("en-CA");
    return meetingDate === todayStr;
  });

  return {
    employees,
    departments,
    meetings,
    metrics: {
      activeEmployees: employees.filter((employee) => employee.status === "active").length,
      departments: departments.length,
      upcomingMeetings: todayMeetings.filter((meeting) => meeting.status === "upcoming").length,
      ongoingMeetings: todayMeetings.filter((meeting) => meeting.status === "ongoing").length,
      completedMeetings: todayMeetings.filter((meeting) => meeting.status === "completed").length,
    },
  };
}

