// Cloudflare Pages Live Analytics In-Memory & Edge Store
// Stores active visitor sessions and real-time funnel events

const SESSIONS_MAP = new Map();
const EVENTS_BUFFER = [];
const MAX_EVENTS = 100;
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes TTL

// Helper to determine device type
export function parseDevice(ua = "", screenWidth = 0) {
  const lower = ua.toLowerCase();
  if (screenWidth > 0) {
    if (screenWidth < 640) return "Mobile";
    if (screenWidth < 1024) return "Tablet";
    return "Desktop";
  }
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(lower)) return "Mobile";
  if (/ipad|tablet|android(?!.*mobile)/i.test(lower)) return "Tablet";
  return "Desktop";
}

// Helper to determine browser name
export function parseBrowser(ua = "") {
  const lower = ua.toLowerCase();
  if (/edg\//i.test(lower)) return "Edge";
  if (/chrome|crios/i.test(lower) && !/edg\//i.test(lower)) return "Chrome";
  if (/safari/i.test(lower) && !/chrome/i.test(lower)) return "Safari";
  if (/firefox|fxios/i.test(lower)) return "Firefox";
  if (/opera|opr\//i.test(lower)) return "Opera";
  return "Browser";
}

// Record or update a live visitor session
export async function updateSession(sessionData, env) {
  const now = Date.now();
  const id = sessionData.sessionId;
  if (!id) return;

  const existing = SESSIONS_MAP.get(id) || {
    sessionId: id,
    visitorId: sessionData.visitorId || id,
    firstSeen: now,
    events: [],
  };

  const updated = {
    ...existing,
    ...sessionData,
    lastActive: now,
  };

  SESSIONS_MAP.set(id, updated);

  // If KV is bound, write session asynchronously
  if (env && env.LIVE_KV) {
    try {
      await env.LIVE_KV.put(`session:${id}`, JSON.stringify(updated), {
        expirationTtl: 900, // 15 mins
      });
    } catch (e) {}
  }

  // Cleanup expired in-memory sessions
  cleanupExpiredSessions();
}

// Record a real-time funnel action
export async function recordEvent(eventData, env) {
  const now = Date.now();
  const event = {
    id: `evt_${now}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    timeIso: new Date(now).toISOString(),
    ...eventData,
  };

  EVENTS_BUFFER.unshift(event);
  if (EVENTS_BUFFER.length > MAX_EVENTS) {
    EVENTS_BUFFER.pop();
  }

  // Update session's last activity and action if sessionId is present
  if (eventData.sessionId && SESSIONS_MAP.has(eventData.sessionId)) {
    const sess = SESSIONS_MAP.get(eventData.sessionId);
    sess.lastActive = now;
    sess.lastAction = eventData.action || eventData.eventName;
    sess.currentUrl = eventData.currentUrl || sess.currentUrl;
  }

  if (env && env.LIVE_KV) {
    try {
      await env.LIVE_KV.put("recent_events", JSON.stringify(EVENTS_BUFFER.slice(0, 50)), {
        expirationTtl: 86400,
      });
    } catch (e) {}
  }
}

// Remove sessions inactive for more than 15 minutes
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, s] of SESSIONS_MAP.entries()) {
    if (now - s.lastActive > SESSION_TIMEOUT_MS) {
      SESSIONS_MAP.delete(id);
    }
  }
}

// Retrieve live analytics state
export async function getLiveState(env) {
  cleanupExpiredSessions();
  const now = Date.now();

  let sessionsList = Array.from(SESSIONS_MAP.values());

  // If memory is empty but KV is bound, read from KV
  if (sessionsList.length === 0 && env && env.LIVE_KV) {
    try {
      const kvEvents = await env.LIVE_KV.get("recent_events", "json");
      if (kvEvents && Array.isArray(kvEvents)) {
        EVENTS_BUFFER.splice(0, EVENTS_BUFFER.length, ...kvEvents);
      }
    } catch (e) {}
  }

  // Active right now: active within last 2 minutes
  const activeNowCount = sessionsList.filter((s) => now - s.lastActive <= 2 * 60 * 1000).length;
  // Recent 15 minutes count
  const active15mCount = sessionsList.length;

  // Sort sessions: most recently active first
  sessionsList.sort((a, b) => b.lastActive - a.lastActive);

  return {
    activeNowCount,
    active15mCount,
    sessions: sessionsList.slice(0, 50),
    events: EVENTS_BUFFER.slice(0, 50),
    timestamp: now,
  };
}
