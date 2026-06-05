/**
 * Cleans up and formats meeting descriptions/agendas.
 * Handles HTML tags like <br> and <a>, and removes unwanted Zoom invitation boilerplate.
 * 
 * @param {string} text - The raw description or agenda text.
 * @returns {string} - Cleaned text suitable for display with whitespace-pre-line.
 */
export function formatDescription(text) {
  if (!text) return "";

  let cleaned = text;

  // 1. Convert <br>, <br/>, <p> to newlines
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  cleaned = cleaned.replace(/<\/p>/gi, "\n");
  cleaned = cleaned.replace(/<p>/gi, "");

  // 2. Handle <a> tags: extract the text content or the URL
  // If the text content is a URL, just keep it.
  cleaned = cleaned.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, url, label) => {
    return label.trim() === url.trim() ? url : `${label} (${url})`;
  });
  
  // 3. Remove any remaining HTML tags
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, "");

  // 4. Decode common HTML entities
  const entities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  };
  Object.keys(entities).forEach(entity => {
    cleaned = cleaned.replace(new RegExp(entity, "g"), entities[entity]);
  });

  // 5. Clean up multiple consecutive newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, "\n\n");

  // 6. Remove common Zoom invitation boilerplate
  const boilerplatePatterns = [
    /.*is inviting you to a scheduled Zoom meeting\./gi,
    /Topic: .*/gi,
    /Time: .*/gi,
    /Join Zoom Meeting\s*https?:\/\/\S+/gi,
    /Meeting ID: \d+/gi,
    /Passcode: \w+/gi,
    /One tap mobile.*/gi,
    /Dial by your location.*/gi,
    /Find your local number:.*/gi,
    /Join by SIP.*/gi,
    /Join by H\.323.*/gi,
    /Join by Skype for Business.*/gi,
    /\+\d+[\d\s,]*#.*/g,         // One-tap mobile patterns
    /\d{3,}\s\d{4,}.*--.*/g,     // Phone number blocks with separators
    /US\s\+\d+.*/gi,             // US dial-in suffix
    /\+\d{1,3}\s\d{10,}/g,       // International phone formats
    /Meeting ID: .*/gi,
    /Passcode: .*/gi,
    /.*--.*\+\d+.*/g,            // Broad catch for "Text -- +Number"
    /\+\d+[\d\s,]*#.*/g,         // Catch one-tap with #
    /^\s*[\d\s\+\-\(\),]{5,}$/gm, // Lines that are only numbers and phone symbols (min 5 chars to avoid stripping list numbers like "1)")
    /^\s*[\(\)]\s*$/gm,          // Lines that only contain a single parenthesis
    /^\s*[•·]\s*$/gm,            // Lines that only contain a bullet or middle dot
    /^Agenda\s*·\s*/gi,          // Strip "Agenda ·" prefix
    /^Agenda\s*:\s*/gi,          // Strip "Agenda:" prefix (handles spaces)
    /View meeting insights with Zoom AI Companion.*/gi,
    /This event was created by the Meeting Management System.*/gi,
    /.*@zoomcrc\.com.*/gi,       // Catch SIP addresses like 9159711778@zoomcrc.com
    /Join instructions.*/gi,      // Catch "Join instructions" text
    /•\s*\d+@zoomcrc\.com.*/gi,  // Catch bulleted SIP addresses
    /SIP:.*/gi,
    /H\.323:.*/gi,
    /Join by Phone.*/gi,
    /Join by Information Systems.*/gi,
    /United States.*/g,          // Usually part of dial-in lists
    /https?:\/\/(\w+\.)?zoom\.us\/\S+/gi, // Any remaining Zoom URLs
    /Microsoft Teams meeting.*/gi,
    /Meeting chat link.*/gi,     // Catch "Meeting chat link"
    /________________________________________________________________________________/g,
    /_{5,}/g,                    // Catch any line of 5 or more underscores
  ];

  boilerplatePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, "");
  });

  return cleaned.trim();
}

/**
 * Strips all newlines and replaces them with spaces.
 * Useful for one-line previews in tables.
 */
export function stripNewlines(text) {
  if (!text) return "";
  return text.replace(/\n+/g, " ").trim();
}
