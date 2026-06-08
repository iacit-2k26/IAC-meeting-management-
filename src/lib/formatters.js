/**
 * Cleans up and formats meeting descriptions/agendas.
 * Handles HTML tags like <br> and <a>, and removes Zoom/Teams/Meet boilerplate.
 *
 * @param {string} text - The raw description or agenda text.
 * @returns {string} - Cleaned text suitable for display.
 */
export function formatDescription(text) {
  if (!text) return "";

  let cleaned = text;

  // 1. Convert HTML block elements to newlines, strip remaining tags
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  cleaned = cleaned.replace(/<\/p>/gi, "\n");
  cleaned = cleaned.replace(/<p[^>]*>/gi, "");
  cleaned = cleaned.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, url, label) =>
    label.trim() === url.trim() ? url : label.trim()
  );
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, "");

  // 2. Decode HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 3. Strip Zoom / Teams / Google Meet boilerplate line-by-line
  const boilerplateLinePatterns = [
    /is inviting you to a scheduled zoom meeting/i,
    /^topic:/i,
    /^time:/i,
    /^join zoom meeting/i,
    /^meeting id:/i,
    /^passcode:/i,
    /^one tap mobile/i,
    /^dial by your location/i,
    /^find your local number/i,
    /^join by sip/i,
    /^join by h\.?323/i,
    /^join by skype/i,
    /^join by phone/i,
    /^join by information/i,
    /^join instructions/i,
    /^sip:/i,
    /^h\.323:/i,
    /^us /i,
    /^united states/i,
    /^meeting chat link/i,
    /microsoft teams meeting/i,
    /view meeting insights/i,
    /this event was created by the meeting management system/i,
    /@zoomcrc\.com/i,
    /zoom\.us\//i,
    /^_{4,}/,
    /^-{4,}/,
  ];

  cleaned = cleaned
    .split("\n")
    .filter(line => {
      const t = line.trim();
      if (!t) return false;
      // Drop lines that are just phone numbers / dial-in codes (digits, spaces, +, -, (, ), #, ,)
      if (/^\+?[\d\s\(\)\-,#]{7,}$/.test(t)) return false;
      // Drop lines matching boilerplate patterns
      if (boilerplateLinePatterns.some(p => p.test(t))) return false;
      // Drop dial-in lines: contain a phone number pattern AND short text (e.g. "US --+1234...")
      if (/[\d]{7,}/.test(t) && /[#,]\s*(US|CA|GB|AU|IN)/i.test(t)) return false;
      // Drop lines that are mostly dashes/underscores with optional short text
      if (/^[\-_\s]{3,}/.test(t) && t.replace(/[\-_\s]/g, "").length < 5) return false;
      // Drop lines that contain a Zoom/Teams URL
      if (/https?:\/\/([\w.]*zoom\.us|teams\.microsoft\.com|meet\.google\.com)/i.test(t)) return false;
      return true;
    })
    .join("\n");

  // 4. Collapse 3+ consecutive blank lines → double newline
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

/**
 * Returns a single-line plain-text preview, max 120 chars.
 * Used for table cell previews.
 */
export function stripNewlines(text) {
  if (!text) return "";
  const single = text.replace(/\n+/g, " · ").replace(/\s{2,}/g, " ").trim();
  // Remove leading separator if present
  const clean = single.replace(/^·\s*/, "");
  return clean.length > 400 ? clean.slice(0, 400) + "…" : clean;
}
