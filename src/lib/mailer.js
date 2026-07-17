import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Transporter — reused across calls (Node.js module singleton)
// ---------------------------------------------------------------------------
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,       // smtp.gmail.com
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,                      // STARTTLS on port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD, // Gmail App Password
    },
  });
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  });
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hour${h > 1 ? "s" : ""}`;
}

// ---------------------------------------------------------------------------
// HTML email template
// ---------------------------------------------------------------------------
function buildInviteHtml({ attendeeName, meeting }) {
  const {
    title,
    agenda,
    scheduleDateTime,
    duration,
    zoomJoinUrl,
    zoomPassword,
    location,
    isVirtual,
  } = meeting;

  const formattedDate = formatDateTime(scheduleDateTime);
  const formattedDuration = formatDuration(Number(duration));
  const senderName = process.env.SMTP_USER;

  const locationSection = !isVirtual && location 
    ? `<div class="detail-row">
          <div class="detail-icon">📍</div>
          <div>
            <div class="detail-label">Location</div>
            <div class="detail-value">${location}</div>
          </div>
        </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meeting Invitation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #1a202c; }
    .wrapper { max-width: 620px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 40px 36px 32px; }
    .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 6px; }
    .body { padding: 36px; }
    .greeting { font-size: 16px; color: #374151; margin-bottom: 20px; }
    .meeting-card { background: #f8faff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .meeting-title { font-size: 20px; font-weight: 700; color: #1e40af; margin-bottom: 16px; }
    .detail-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .detail-icon { font-size: 18px; width: 24px; flex-shrink: 0; margin-top: 2px; }
    .detail-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-value { font-size: 14px; color: #111827; font-weight: 500; margin-top: 2px; }
    .agenda-box { background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 16px; margin: 20px 0; }
    .agenda-box h3 { font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .agenda-box p { font-size: 14px; color: #451a03; line-height: 1.6; }
    .join-btn { display: block; width: fit-content; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 24px 0; }
    .password-row { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #374151; }
    .password-row code { font-family: 'Courier New', monospace; font-weight: 700; color: #1e40af; font-size: 15px; }
    .footer { background: #f8faff; border-top: 1px solid #e5e7eb; padding: 24px 36px; font-size: 12px; color: #9ca3af; }
    .footer a { color: #6b7280; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📅 You're Invited to a Meeting</h1>
      <p>Please find your meeting details below</p>
    </div>

    <div class="body">
      <p class="greeting">Hi ${attendeeName || "there"},</p>
      <p style="font-size:14px;color:#4b5563;margin-bottom:24px;line-height:1.6;">
        You have been invited to the following meeting. Please review the details and join using the link provided.
      </p>

      <div class="meeting-card">
        <div class="meeting-title">${title}</div>

        <div class="detail-row">
          <div class="detail-icon">🗓</div>
          <div>
            <div class="detail-label">Date &amp; Time</div>
            <div class="detail-value">${formattedDate}</div>
          </div>
        </div>

        <div class="detail-row">
          <div class="detail-icon">⏱</div>
          <div>
            <div class="detail-label">Duration</div>
            <div class="detail-value">${formattedDuration}</div>
          </div>
        </div>

        ${locationSection}

        <div class="detail-row">
          <div class="detail-icon">🔗</div>
          <div>
            <div class="detail-label">Meeting Link</div>
            <div class="detail-value"><a href="${zoomJoinUrl}" style="color:#2563eb;">${zoomJoinUrl}</a></div>
          </div>
        </div>
      </div>

      ${
        agenda
          ? `<div class="agenda-box">
        <h3>📋 Agenda</h3>
        <p>${agenda.replace(/\n/g, "<br/>")}</p>
      </div>`
          : ""
      }

      <a href="${zoomJoinUrl}" class="join-btn">Join Zoom Meeting →</a>

      ${
        zoomPassword
          ? `<div class="password-row">🔑 Meeting Password: <code>${zoomPassword}</code></div>`
          : ""
      }

      <p style="font-size:13px;color:#6b7280;margin-top:24px;line-height:1.6;">
        A Google Calendar invite has also been sent to your email. You can accept it to add this meeting to your calendar automatically.
      </p>
    </div>

    <div class="footer">
      <p>Sent by <a href="mailto:${senderName}">${senderName}</a> via the IAC Meeting Management System.</p>
      <p style="margin-top:6px;">If you believe this was sent in error, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Plain text fallback
// ---------------------------------------------------------------------------
function buildInviteText({ attendeeName, meeting }) {
  const { title, agenda, scheduleDateTime, duration, zoomJoinUrl, zoomPassword, location, isVirtual } = meeting;
  return [
    `Hi ${attendeeName || "there"},`,
    "",
    `You are invited to: ${title}`,
    `Date & Time: ${formatDateTime(scheduleDateTime)}`,
    `Duration: ${formatDuration(Number(duration))}`,
    !isVirtual && location ? `Location: ${location}` : "",
    agenda ? `Agenda: ${agenda}` : "",
    "",
    `Join Zoom: ${zoomJoinUrl}`,
    zoomPassword ? `Password: ${zoomPassword}` : "",
    "",
    "A Google Calendar invite has also been sent to your email.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ---------------------------------------------------------------------------
// Main export — send invitation email to a single attendee
// ---------------------------------------------------------------------------
async function sendSingleInvite(transporter, attendee, meeting) {
  const attendeeName = attendee.firstName
    ? `${attendee.firstName} ${attendee.lastName || ""}`.trim()
    : attendee.name || "";

  const html = buildInviteHtml({ attendeeName, meeting });
  const text = buildInviteText({ attendeeName, meeting });

  await transporter.sendMail({
    from: `"Meeting Management" <${process.env.SMTP_USER}>`,
    to: attendee.email,
    subject: `📅 Meeting Invitation: ${meeting.title}`,
    html,
    text,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send meeting invitation emails to all attendees via SMTP (Gmail).
 * @param {object} meeting  - The meeting document (title, agenda, scheduleDateTime, duration, zoomJoinUrl, zoomPassword)
 * @param {Array}  attendees - Array of { email, firstName?, lastName?, name? }
 */
export async function sendMeetingInvitations(meeting, attendees = []) {
  if (!attendees || attendees.length === 0) return;

  const transporter = createTransporter();

  // Verify SMTP connection once (throws if credentials are wrong)
  try {
    await transporter.verify();
  } catch (err) {
    console.error("[Mailer] SMTP connection failed:", err.message);
    throw new Error("SMTP connection failed. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env");
  }

  const results = await Promise.allSettled(
    attendees.map((attendee) => sendSingleInvite(transporter, attendee, meeting))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    failures.forEach((f) => console.error("[Mailer] Failed to send to attendee:", f.reason));
  }

  const successCount = results.length - failures.length;
}

/**
 * Send a meeting update notification email to all attendees.
 */
export async function sendMeetingUpdateNotifications(meeting, attendees = []) {
  if (!attendees || attendees.length === 0) return;

  const transporter = createTransporter();

  try {
    await transporter.verify();
  } catch (err) {
    console.error("[Mailer] SMTP connection failed:", err.message);
    return;
  }

  const { title, scheduleDateTime, duration, zoomJoinUrl, zoomPassword, location, isVirtual } = meeting;

  const results = await Promise.allSettled(
    attendees.map((attendee) => {
      const attendeeName = attendee.firstName
        ? `${attendee.firstName} ${attendee.lastName || ""}`.trim()
        : attendee.name || "";

      return transporter.sendMail({
        from: `"Meeting Management" <${process.env.SMTP_USER}>`,
        to: attendee.email,
        subject: `🔄 Meeting Updated: ${title}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;">
          <h2 style="color:#2563eb;">Meeting Details Updated</h2>
          <p>Hi ${attendeeName || "there"},</p>
          <p>The meeting <strong>${title}</strong> has been updated. Here are the latest details:</p>
          <ul style="margin:16px 0;line-height:2;">
            <li><strong>Date &amp; Time:</strong> ${formatDateTime(scheduleDateTime)}</li>
            <li><strong>Duration:</strong> ${formatDuration(Number(duration))}</li>
            ${!isVirtual && location ? `<li><strong>Location:</strong> ${location}</li>` : ""}
            <li><strong>Join Link:</strong> <a href="${zoomJoinUrl}">${zoomJoinUrl}</a></li>
            ${zoomPassword ? `<li><strong>Password:</strong> ${zoomPassword}</li>` : ""}
          </ul>
          <p>Your Google Calendar invite has also been updated.</p>
        </div>`,
        text: `Meeting Updated: ${title}\nDate: ${formatDateTime(scheduleDateTime)}\n${!isVirtual && location ? `Location: ${location}\n` : ""}Join: ${zoomJoinUrl}`,
      });
    })
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    failures.forEach((f) => console.error("[Mailer] Update email failed:", f.reason));
  }
}

/**
 * Send a meeting cancellation email to all attendees.
 */
export async function sendMeetingCancellationNotifications(meeting, attendees = []) {
  if (!attendees || attendees.length === 0) return;

  const transporter = createTransporter();

  try {
    await transporter.verify();
  } catch (err) {
    console.error("[Mailer] SMTP connection failed:", err.message);
    return;
  }

  const { title, scheduleDateTime } = meeting;

  await Promise.allSettled(
    attendees.map((attendee) => {
      const attendeeName = attendee.firstName
        ? `${attendee.firstName} ${attendee.lastName || ""}`.trim()
        : attendee.name || "";

      return transporter.sendMail({
        from: `"Meeting Management" <${process.env.SMTP_USER}>`,
        to: attendee.email,
        subject: `❌ Meeting Cancelled: ${title}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;">
          <h2 style="color:#dc2626;">Meeting Cancelled</h2>
          <p>Hi ${attendeeName || "there"},</p>
          <p>The meeting <strong>${title}</strong> originally scheduled for <strong>${formatDateTime(scheduleDateTime)}</strong> has been cancelled.</p>
          <p>Your Google Calendar event has been removed as well.</p>
        </div>`,
        text: `Meeting Cancelled: ${title}\nOriginally scheduled: ${formatDateTime(scheduleDateTime)}`,
      });
    })
  );
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(toEmail, resetLink) {
  const transporter = createTransporter();

  try {
    await transporter.verify();
  } catch (err) {
    console.error("[Mailer] SMTP connection failed:", err.message);
    throw new Error("SMTP connection failed. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env");
  }

  await transporter.sendMail({
    from: `"IAC Meeting Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Password Reset Request",
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Hi there,</p>
  <p>We received a request to reset the password for your account. Click the button below to set a new password.</p>
  <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #2B3990; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
  <p>If you didn't request this, you can safely ignore this email. Your password won't change unless you click the button above.</p>
  <p>This link will expire in 1 hour for security reasons.</p>
</div>`,
    text: `Hi there,

We received a request to reset the password for your account. Click the link below to set a new password:

${resetLink}

If you didn't request this, you can safely ignore this email. Your password won't change unless you click the link above.

This link will expire in 1 hour for security reasons.`,
  });
}

/**
 * Send an account activation email when admin approves the user.
 */
export async function sendAccountActivatedEmail(toEmail, fullName) {
  const transporter = createTransporter();

  try {
    await transporter.verify();
  } catch (err) {
    console.error("[Mailer] SMTP connection failed:", err.message);
    throw new Error("SMTP connection failed. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env");
  }

  await transporter.sendMail({
    from: `"IAC Meeting Management" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Account Activated - IAC Meeting Central",
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <h2 style="color: #2B3990;">Account Activated!</h2>
  <p>Hi ${fullName},</p>
  <p>Good news! Your account on **IAC Meeting Central** has been approved and activated by the administrator.</p>
  <p>You can now log in using your registered email and password to access the dashboard and manage meetings.</p>
  <p style="margin-top: 24px;"><a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" style="display: inline-block; padding: 12px 24px; background-color: #2B3990; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In Now</a></p>
  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #64748b;">This email was sent automatically. If you did not register for an account, please ignore this email.</p>
</div>`,
    text: `Hi ${fullName},

Good news! Your account on IAC Meeting Central has been approved and activated by the administrator.

You can now log in using your registered email and password:
${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login

Thank you,
IAC Meeting Management Team`,
  });
}
