const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;

let cachedToken = null;
let tokenExpiry = 0;

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
  try {
    const token = await getZoomAccessToken();
    
    // Zoom API expects ISO 8601 format (e.g., 2022-03-25T07:32:55Z)
    // If startTime doesn't have a timezone, we treat it as the server's local time
    const startDateTime = new Date(startTime).toISOString();
    
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
      throw new Error(data.message || "Failed to create Zoom meeting");
    }

    return {
      id: String(data.id),
      joinUrl: data.join_url,
      password: data.password,
    };
  } catch (error) {
    console.error("Zoom Service Error:", error);
    throw error;
  }
}

export async function deleteZoomMeeting(meetingId) {
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
      throw new Error(data.message || "Failed to delete Zoom meeting");
    }
    
    return true;
  } catch (error) {
    console.error("Zoom Service Error:", error);
    return false;
  }
}

export async function updateZoomMeeting(zoomMeetingId, { topic, agenda, startTime, duration }) {
  try {
    const token = await getZoomAccessToken();
    
    // Zoom API expects ISO 8601 format (e.g., 2022-03-25T07:32:55Z)
    const startDateTime = new Date(startTime).toISOString();
    
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
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error("Zoom Update Meeting Error:", data);
      throw new Error(data.message || "Failed to update Zoom meeting");
    }
    
    return true;
  } catch (error) {
    console.error("Zoom Service Error:", error);
    throw error;
  }
}

export async function addZoomRegistrants(zoomMeetingId, attendees = []) {
  if (!attendees || attendees.length === 0) return;

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
    return false;
  }
}
