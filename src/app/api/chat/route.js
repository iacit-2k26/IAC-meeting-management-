import { NextResponse } from "next/server";
import { listDepartments, listEmployees, createMeeting, listMeetings } from "@/lib/repository";
import { Mistral } from "@mistralai/mistralai";
import Groq from "groq-sdk";
import OpenAI from "openai";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || "",
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000", // Optional, for OpenRouter analytics
    "X-Title": "IAC Meeting Central", // Optional, for OpenRouter analytics
  }
});

export async function POST(request) {
  try {
    const { message, sessionData, userDateTime } = await request.json();
    if (!message) throw new Error("Message is required");

    const [departments, employees, allMeetings] = await Promise.all([
      listDepartments(),
      listEmployees(),
      listMeetings(userDateTime),
    ]);

    let currentMeeting = sessionData || {
      departmentName: null,
      title: null,
      meetingType: null,
      time: null,
      duration: null,
      agenda: null,
      location: null,
      isVirtual: true,
      internalAttendeeNames: [],
      externalAttendees: [],
    };

    let aiResponseText = "";
    let intent = "general_chat";

    // 1. Try OpenRouter (Primary)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const prompt = `
          You are a helpful meeting assistant for "IAC Meeting Central". 
          You have FULL ACCESS to the organization's data provided below.

          DATA ACCESS:
          - Departments: ${JSON.stringify(departments.map(d => ({ id: d.id, name: d.name })))}
          - Employees: ${JSON.stringify(employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, deptId: e.departmentId })))}
          - Upcoming Meetings (from DB & GCal): ${JSON.stringify(allMeetings.map(m => ({ title: m.title, time: m.scheduleDateTime, deptIds: m.departmentIds })))}
          
          Current conversation state for scheduling: ${JSON.stringify(currentMeeting)}
          New user message: "${message}"
          User's Current Date/Time: ${userDateTime || new Date().toLocaleString()}

          INTENTS:
          1. "schedule_meeting": User wants to create a NEW meeting.
          2. "query_meetings": User is asking about EXISTING meetings (e.g., "any meetings tomorrow?", "what meetings do I have on Friday?", "my schedule for June 20th").
          3. "general_chat": Greeting or general talk.

          TASKS:
          - For "query_meetings": 
            1. Identify the specific date the user is asking about based on 'User's Current Date/Time'.
            2. "Today" is ${new Date(userDateTime).toDateString()}.
            3. "Tomorrow" is ${new Date(new Date(userDateTime).getTime() + 86400000).toDateString()}.
            4. Compare this target date with the 'Upcoming Meetings' ISO timestamps.
            5. Summarize the meetings for that specific day. If no meetings, say so.
          - For "schedule_meeting": 
            1. Follow the multi-turn collection process. Ask for missing details (dept, title, meetingType, time, duration, agenda, location/type, attendees) one by one. 
            2. If the user provides a "type" but no "title", use a descriptive title like "[Department] [Type]".
            3. For "duration", extract the number of minutes. If not specified, default to 30.
            4. For "agenda", if the user says "none", "nothing", or similar, set it to an empty string or "No agenda provided".
            5. For "location", ask if the meeting is "Online" (Virtual) or "In Person". 
               - If "Online", set 'isVirtual' to true and 'location' to null.
               - If "In Person", set 'isVirtual' to false and ask for the specific location (e.g., "Conference Room A").
            6. For "attendees":
               - Identify "Internal Attendees" from the 'Employees' data based on names.
               - Identify "External Attendees" (guests) who are NOT in the 'Employees' list. Collect their name and email if provided.
            7. Keep questions short.
          - If the user asks about people or departments: Use the 'Employees' and 'Departments' data to answer accurately and briefly.
          - IMPORTANT: Your response will be read aloud. Avoid long lists, bullet points, or complex formatting. Use natural, conversational language.
          - VOICE INPUT NUANCE: Ignore filler words (like "um", "uh", "well") and focus on core intent.

          Return ONLY a JSON object with:
          {
            "intent": "schedule_meeting" | "query_meetings" | "general_chat",
            "meetingDetails": {
              "departmentName": "matching department name or null",
              "title": "meeting title (be descriptive, e.g. 'Admissions Weekly Review') or null",
              "meetingType": "type of meeting (e.g., Review, Brainstorming, etc.) or null",
              "time": "ISO string for the scheduled time or null",
              "duration": "number of minutes or null",
              "agenda": "meeting agenda or null",
              "location": "specific location string or null",
              "isVirtual": boolean,
              "internalAttendeeNames": ["list of matched employee full names"],
              "externalAttendees": [{"name": "string", "email": "string"}],
              "isConfirmed": boolean
            },
            "response": "Your friendly, data-informed response."
          }
        `;

        const completion = await openRouter.chat.completions.create({
          model: "openai/gpt-oss-120b:free",
          messages: [{ role: "user", content: prompt }],
          // response_format: { type: "json_object" }, // Some free models on OpenRouter don't support strict JSON mode
        });

        const rawContent = completion.choices[0].message.content;
        
        // Robust JSON extraction in case the model adds conversational filler
        let jsonStr = rawContent;
        if (rawContent.includes("```json")) {
          jsonStr = rawContent.split("```json")[1].split("```")[0].trim();
        } else if (rawContent.includes("{") && rawContent.includes("}")) {
          jsonStr = rawContent.substring(rawContent.indexOf("{"), rawContent.lastIndexOf("}") + 1);
        }

        const aiData = JSON.parse(jsonStr);
        if (aiData) {
          intent = aiData.intent || "general_chat";
          aiResponseText = aiData.response || "How can I help you today?";
          currentMeeting = aiData.meetingDetails || currentMeeting;
        }

      } catch (aiError) {
        console.error("OpenRouter AI Error:", aiError);
      }
    }

    // Fallback to Groq if OpenRouter fails or key is missing
    if (!aiResponseText && process.env.GROQ_API_KEY) {
      try {
        const prompt = `
          You are a helpful meeting assistant for "IAC Meeting Central". 
          You have FULL ACCESS to the organization's data provided below.

          DATA ACCESS:
          - Departments: ${JSON.stringify(departments.map(d => ({ id: d.id, name: d.name })))}
          - Employees: ${JSON.stringify(employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, deptId: e.departmentId })))}
          - Upcoming Meetings (from DB & GCal): ${JSON.stringify(allMeetings.map(m => ({ title: m.title, time: m.scheduleDateTime, deptIds: m.departmentIds })))}
          
          Current conversation state for scheduling: ${JSON.stringify(currentMeeting)}
          New user message: "${message}"
          User's Current Date/Time: ${userDateTime || new Date().toLocaleString()}

          INTENTS:
          1. "schedule_meeting": User wants to create a NEW meeting.
          2. "query_meetings": User is asking about EXISTING meetings.
          3. "general_chat": Greeting or general talk.

          TASKS:
          - For "query_meetings": Summarize the meetings for that specific day based on the user's request and current date.
          - For "schedule_meeting": 
             1. Follow the multi-turn collection process. Ask for missing details one by one.
             2. If the user provides a "type" but no "title", use a descriptive title like "[Department] [Type]".
             3. For "duration", extract the number of minutes. If not specified, default to 30.
             4. For "agenda", if the user says "none", "nothing", or similar, set it to an empty string or "No agenda provided".
             5. For "location", ask if the meeting is "Online" (Virtual) or "In Person". 
                - If "Online", set 'isVirtual' to true and 'location' to null.
                - If "In Person", set 'isVirtual' to false and ask for the specific location (e.g., "Conference Room A").
             6. For "attendees": Identify "Internal Attendees" from provided employees and "External Attendees" (guests) with names/emails.
          - If the user asks about people or departments: Use the provided data to answer accurately.

          Return ONLY a JSON object with:
          {
            "intent": "schedule_meeting" | "query_meetings" | "general_chat",
            "meetingDetails": {
              "departmentName": "matching department name or null",
              "title": "meeting title (be descriptive, e.g. 'Admissions Weekly Review') or null",
              "meetingType": "type of meeting (e.g., Review, Brainstorming, etc.) or null",
              "time": "ISO string for the scheduled time or null",
              "duration": "number of minutes or null",
              "agenda": "meeting agenda or null",
              "location": "specific location string or null",
              "isVirtual": boolean,
              "internalAttendeeNames": ["list of matched employee full names"],
              "externalAttendees": [{"name": "string", "email": "string"}],
              "isConfirmed": boolean
            },
            "response": "Your friendly, data-informed response."
          }
        `;

        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
        });

        const aiData = JSON.parse(chatCompletion.choices[0].message.content);
        if (aiData) {
          intent = aiData.intent || "general_chat";
          aiResponseText = aiData.response || "How can I help you today?";
          currentMeeting = aiData.meetingDetails || currentMeeting;
        }

      } catch (aiError) {
        console.error("Groq AI Error:", aiError);
      }
    }

    // Process the intent
    if (intent === "query_meetings") {
       return NextResponse.json({ 
         answer: aiResponseText
       });
    }

    if (intent === "schedule_meeting") {
      // Check if we have everything and user confirmed
      const { 
        departmentName, 
        title, 
        meetingType, 
        time, 
        duration, 
        agenda, 
        location, 
        isVirtual, 
        internalAttendeeNames,
        externalAttendees,
        isConfirmed 
      } = currentMeeting;

      if (departmentName && title && time && isConfirmed) {
        // Find Dept
        const dept = departments.find(d => d.name.toLowerCase() === departmentName.toLowerCase());
        if (!dept) {
           return NextResponse.json({ 
             answer: "I'm sorry, I couldn't find that department in our system. Which department should I use?",
             sessionData: { ...currentMeeting, departmentName: null }
           });
        }

        // Determine Host and Internal Attendees
        let host;
        let internalAttendeeIds = [];

        if (internalAttendeeNames && internalAttendeeNames.length > 0) {
          // If user specified names, match them to employee IDs
          internalAttendeeNames.forEach(name => {
            const emp = employees.find(e => `${e.firstName} ${e.lastName}`.toLowerCase() === name.toLowerCase());
            if (emp) internalAttendeeIds.push(emp.id);
          });
        }

        // If no specific attendees matched, or none specified, default to department
        if (internalAttendeeIds.length === 0) {
          const deptEmployees = employees.filter(e => e.departmentId === dept.id && e.status === "active");
          if (deptEmployees.length === 0) {
            return NextResponse.json({ 
              answer: `I found the ${dept.name} department, but there are no active employees assigned to it. I cannot create the meeting without a host.` 
            });
          }
          internalAttendeeIds = deptEmployees.map(e => e.id);
          host = deptEmployees[0];
        } else {
          // Use the first specified attendee as host
          host = employees.find(e => e.id === internalAttendeeIds[0]);
        }

        const meetingPayload = {
          title,
          meetingType: meetingType || "",
          agenda: (agenda !== null && agenda !== undefined) ? agenda : `Automated departmental meeting for ${dept.name}.`,
          scheduleDateTime: new Date(time).toISOString(),
          duration: parseInt(duration) || 30,
          location: location || "",
          isVirtual: isVirtual !== undefined ? isVirtual : true,
          hostId: host.id,
          departmentIds: [dept.id],
          internalAttendeeIds: internalAttendeeIds, 
          externalAttendees: externalAttendees || [],
          status: "upcoming",
        };

        const meeting = await createMeeting(meetingPayload);

        let confirmationMsg = `Perfect! I've scheduled the "${title}" meeting for the ${dept.name} department. \n\n**Host:** ${host.firstName} ${host.lastName}\n**Internal Attendees:** ${internalAttendeeIds.length} members.`;
        
        if (externalAttendees && externalAttendees.length > 0) {
          confirmationMsg += `\n**Guests:** ${externalAttendees.length} external invitees.`;
        }
        
        confirmationMsg += `\n**Time:** ${new Date(time).toLocaleString()}\n**Duration:** ${duration || 30} minutes\n**Location:** ${isVirtual ? "Online (Zoom)" : (location || "In Person")}`;

        return NextResponse.json({ 
          answer: confirmationMsg,
          meeting 
        });
      }

      // If not confirmed or missing info, return the AI's question
      return NextResponse.json({ 
        answer: aiResponseText,
        sessionData: currentMeeting
      });
    }

    // Default to general chat response
    return NextResponse.json({ 
      answer: aiResponseText || "I'm here to help you manage your meetings. What would you like to do?" 
    });

  } catch (error) {
    console.error("[Chat API Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat" }, { status: 400 });
  }
}
