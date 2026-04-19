/**
 * POST /api/track - receives analytics events from the client.
 *
 * Uses Upstash Redis for storage.
 * Privacy: no raw IPs stored, only transient hashed rate-limit keys.
 */

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';

export const prerender = false;

// ─── Redis client ───

function getRedis(): Redis | null {
  const url = import.meta.env.KV_REST_API_URL || import.meta.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.KV_REST_API_TOKEN || import.meta.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ─── Helpers ───

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Route handler ───

export const POST: APIRoute = async ({ request }) => {
  const redis = getRedis();
  if (!redis) {
    return new Response(JSON.stringify({ ok: false, reason: 'kv-not-configured' }), { status: 503 });
  }

  // ─── Rate limiting ───
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  const ipHash = await hashIP(ip);
  const rlKey = `ratelimit:${ipHash}`;

  const rlCount = await redis.incr(rlKey);
  if (rlCount === 1) {
    await redis.expire(rlKey, 60);
  }
  if (rlCount > 60) {
    return new Response(JSON.stringify({ ok: false, reason: 'rate-limited' }), { status: 429 });
  }

  // ─── Parse body ───
  let body: {
    event?: string;
    session_id?: string;
    props?: Record<string, unknown>;
    duration_ms?: number;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: 'invalid-json' }), { status: 400 });
  }

  const { event, session_id: sessionId } = body;
  if (!event || !sessionId || typeof sessionId !== 'string' || sessionId.length > 32) {
    return new Response(JSON.stringify({ ok: false, reason: 'missing-fields' }), { status: 400 });
  }

  const date = todayUTC();

  try {
    switch (event) {
      case 'session_start': {
        const seenKey = `session:${sessionId}:seen`;
        const alreadySeen = await redis.get(seenKey);
        if (!alreadySeen) {
          await redis.set(seenKey, 1, { ex: 86400 });
          await redis.incr(`daily:${date}:visitors`);
          await redis.incr('alltime:visitors');
        }
        break;
      }

      // ─── Per-session events (S1, S2, S4) ───
      case 's1_bet_locked':
      case 's2_preset_clicked':
      case 's4_slider_engaged': {
        const flagKey = `session:${sessionId}:${event}`;
        const already = await redis.get(flagKey);
        if (!already) {
          await redis.set(flagKey, 1, { ex: 86400 });
          await redis.incr(`alltime:${event}:sessions`);
        }
        break;
      }

      // ─── Simulation events (S3, S5): total + distinct sessions + any_simulation ───
      case 's3_simulation_run':
      case 's5_simulation_run': {
        // Increment total runs
        await redis.incr(`alltime:${event}:total`);

        // Dedupe session counter for this section
        const sectionFlagKey = `session:${sessionId}:${event}`;
        const sectionSeen = await redis.get(sectionFlagKey);
        if (!sectionSeen) {
          await redis.set(sectionFlagKey, 1, { ex: 86400 });
          await redis.incr(`alltime:${event}:sessions`);
        }

        // Dedupe cross-section "any simulation" counter
        const anyFlagKey = `session:${sessionId}:any_simulation`;
        const anySeen = await redis.get(anyFlagKey);
        if (!anySeen) {
          await redis.set(anyFlagKey, 1, { ex: 86400 });
          await redis.incr('alltime:any_simulation:sessions');
        }
        break;
      }

      case 'scrolled_to_bottom': {
        const scrollKey = `session:${sessionId}:scrolled_bottom`;
        const alreadyScrolled = await redis.get(scrollKey);
        if (!alreadyScrolled) {
          await redis.set(scrollKey, 1, { ex: 86400 });
          await redis.incr(`daily:${date}:scrolled_to_bottom`);
          await redis.incr('alltime:scrolled_to_bottom');
        }
        break;
      }

      case 'session_end': {
        const durationMs = body.duration_ms;
        if (typeof durationMs !== 'number' || durationMs < 1000 || durationMs > 3600000) {
          break; // Ignore invalid durations
        }
        await redis.incrby(`daily:${date}:total_time_ms`, Math.round(durationMs));
        await redis.incrby('alltime:total_time_ms', Math.round(durationMs));
        await redis.incr(`daily:${date}:session_count_with_time`);
        await redis.incr('alltime:session_count_with_time');
        break;
      }

      default:
        // Unknown event - ignore silently
        break;
    }
  } catch (err) {
    console.error('[track] Redis error:', err);
    return new Response(JSON.stringify({ ok: false, reason: 'internal' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
