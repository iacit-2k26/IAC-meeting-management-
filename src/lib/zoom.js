const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;

let cachedToken = null;
let tokenExpiry = 0;

// Check if Zoom is configured
function isZoomConfigured() {
  return ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET && ZOOM_ACCOUNT_ID;
}

// Helper function to parse datetime string as Asia/Kolkata time
function parseAsIAST(dateTimeStr) {
  // dateTimeStr format: YYYY-MM-DDTHH:MM
  // We need to create a Date object that represents this exact time in Asia/Kolkata

  // Just create the date string with the correct timezone offset for IST (UTC+5:30)
  // Format it as: YYYY-MM-DDTHH:MM:SS+05:30
  const istDateTimeStr = `${dateTimeStr}:00+05:30`;

  // This will correctly parse the time as Asia/Kolkata
  return new Date(istDateTimeStr);
}

async function getZoomAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const auth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error("Zoom Auth Error:", data);
    throw new Error(data.reason || "Failed to get Zoom access token");
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Cache with 1 min buffer
  
  return cachedToken;
}

export async function createZoomMeeting({ topic, agenda, startTime, duration }) {
  if (!isZoomConfigured()) {
    console.warn("[Zoom] Credentials not configured. Skipping Zoom meeting creation.");
    return { id: "", joinUrl: "", password: "" };
  }
  
  try {
    const token = await getZoomAccessToken();
    
    // Parse startTime as Asia/Kolkata time and convert to ISO string
    const startDateTime = parseAsIAST(startTime).toISOString();
    
    const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
        agenda: agenda || "", // Ensure agenda is at least an empty string
        type: 2, // Scheduled meeting
        start_time: startDateTime,
        duration,
        timezone: "Asia/Kolkata",
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          // NOTE: approval_type 2 = No Registration Required.
          // We intentionally do NOT use approval_type 0 (which sends Zoom emails).
          // All invitations are handled by our own Gmail SMTP mailer.
          approval_type: 2,
          audio: "both",
          auto_recording: "none",
          // Zoom emails are disabled — we send our own via Nodemailer
          registrants_email_notification: false,
        },
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Zoom Create Meeting Error:", data);
      // Don't throw - just return empty values so meeting creation still works
      console.warn("[Zoom] Failed to create Zoom meeting, proceeding without it.");
      return { id: "", joinUrl: "", password: "" };
    }

    return {
      id: String(data.id),
      joinUrl: data.join_url,
      password: data.password,
    };
  } catch (error) {
    console.error("Zoom Service Error:", error);
    // Don't throw - just return empty values so meeting creation still works
    console.warn("[Zoom] Error creating Zoom meeting, proceeding without it.");
    return { id: "", joinUrl: "", password: "" };
  }
}

export async function deleteZoomMeeting(meetingId) {
  if (!isZoomConfigured() || !meetingId) {
    console.warn("[Zoom] Credentials not configured or no meeting ID. Skipping Zoom meeting deletion.");
    return true;
  }
  
  try {
    const token = await getZoomAccessToken();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const data = await response.json();
      console.error("Zoom Delete Meeting Error:", data);
      // Don't throw - just log it
    }
    
    return true;
  } catch (error) {
    console.error("Zoom Service Error:", error);
    return true; // Don't fail the whole operation
  }
}

export async function updateZoomMeeting(zoomMeetingId, { topic, agenda, startTime, duration }) {
  if (!isZoomConfigured() || !zoomMeetingId) {
    console.warn("[Zoom] Credentials not configured or no meeting ID. Skipping Zoom meeting update.");
    return true;
  }
  
  try {
    const token = await getZoomAccessToken();
    
    // Parse startTime as Asia/Kolkata time and convert to ISO string
    const startDateTime = parseAsIAST(startTime).toISOString();
    
    const response = await fetch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic,
        agenda: agenda || "",
        start_time: startDateTime,
        duration,
        timezone: "Asia/Kolkata",
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error("Zoom Update Meeting Error:", data);
      // Don't throw - just log it
    }
    
    return true;
  } catch (error) {
    console.error("Zoom Service Error:", error);
    return true; // Don't fail the whole operation
  }
}

export async function addZoomRegistrants(zoomMeetingId, attendees = []) {
  if (!isZoomConfigured() || !zoomMeetingId || !attendees || attendees.length === 0) {
    return true;
  }

  try {
    const token = await getZoomAccessToken();
    
    // Zoom batch registrants limit is 30 per request
    const batchSize = 30;
    for (let i = 0; i < attendees.length; i += batchSize) {
      const batch = attendees.slice(i, i + batchSize).map(attendee => ({
        email: attendee.email,
        first_name: attendee.firstName || attendee.name.split(" ")[0] || "Guest",
        last_name: attendee.lastName || attendee.name.split(" ").slice(1).join(" ") || "Attendee",
      }));

      const response = await fetch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}/batch_registrants`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrants: batch,
          auto_approve: true,
          registrants_confirmation_email: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("Zoom Batch Registration Error:", data);
        // We don't throw here to allow other batches to proceed, but we log it
      }
    }
    
    return true;
  } catch (error) {
    console.error("Zoom Registration Service Error:", error);
    return true; // Don't fail the whole operation
  }
}
