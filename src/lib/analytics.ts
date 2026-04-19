/**
 * Minimal, privacy-respecting analytics client.
 *
 * - No cookies, no localStorage - session ID held in memory only
 * - All events POST to /api/track (same-origin)
 * - In dev mode, events are logged to console instead
 * - Fire-and-forget: silently fails if network is unavailable
 */

const isDev = import.meta.env.DEV;

// ─── Session ID (random 16-char hex, memory-only) ───

function generateSessionId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

const sessionId = generateSessionId();
const sessionStartTime = Date.now();

// ─── Core track function ───

export function track(event: string, props?: Record<string, unknown>): void {
  if (isDev) {
    console.log(`[analytics] ${event}`, props ?? {});
    return;
  }

  const body = JSON.stringify({
    event,
    session_id: sessionId,
    props,
  });

  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silently fail
  }
}

// ─── Session lifecycle ───

// Fire session_start on import
track('session_start');

export function endSession(): void {
  const durationMs = Date.now() - sessionStartTime;

  if (isDev) {
    console.log(`[analytics] session_end`, { duration_ms: durationMs });
    return;
  }

  const body = JSON.stringify({
    event: 'session_end',
    session_id: sessionId,
    duration_ms: durationMs,
  });

  // Use sendBeacon for reliability on tab close
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

// ─── Scroll-to-bottom tracking ───

let scrolledToBottom = false;

export function initScrollTracking(): void {
  const sentinel = document.getElementById('bottom-of-page');
  if (!sentinel) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !scrolledToBottom) {
        scrolledToBottom = true;
        track('scrolled_to_bottom');
        observer.disconnect();
      }
    }
  }, { threshold: 0 });

  observer.observe(sentinel);
}
