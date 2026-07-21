import { getClientIp, createSession, sessionCookieHeader, toSqlUtc, parseSqlUtc } from './_auth.js';

const MAX_ATTEMPTS = 2;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!env.DEV_PASSWORD) {
    return Response.json({ error: 'Developer login is not configured.' }, { status: 500 });
  }

  const password = String(data.password || '');
  const ip = getClientIp(request);
  const now = new Date();

  let attempt = await env.DB.prepare(
    'SELECT failed_count, locked_until FROM login_attempts WHERE ip = ?'
  ).bind(ip).first();

  if (attempt && attempt.locked_until) {
    const lockedUntil = parseSqlUtc(attempt.locked_until);
    if (lockedUntil > now) {
      const minutesLeft = Math.max(1, Math.ceil((lockedUntil - now) / 60000));
      return Response.json(
        { error: `Too many attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` },
        { status: 429 }
      );
    }
    attempt = null; // lock has expired, start fresh
  }

  if (password && password === env.DEV_PASSWORD) {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
    const { token, maxAgeSeconds } = await createSession(env);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', sessionCookieHeader(request, token, maxAgeSeconds));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  const failedCount = (attempt ? attempt.failed_count : 0) + 1;

  if (failedCount >= MAX_ATTEMPTS) {
    const lockedUntil = toSqlUtc(new Date(now.getTime() + LOCKOUT_MS));
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, failed_count, locked_until) VALUES (?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET failed_count = excluded.failed_count, locked_until = excluded.locked_until`
    ).bind(ip, failedCount, lockedUntil).run();
    return Response.json(
      { error: 'Incorrect password. Too many attempts — locked for 15 minutes.' },
      { status: 429 }
    );
  }

  await env.DB.prepare(
    `INSERT INTO login_attempts (ip, failed_count, locked_until) VALUES (?, ?, NULL)
     ON CONFLICT(ip) DO UPDATE SET failed_count = excluded.failed_count, locked_until = NULL`
  ).bind(ip, failedCount).run();

  const triesLeft = MAX_ATTEMPTS - failedCount;
  return Response.json(
    { error: `Incorrect password. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} remaining.` },
    { status: 401 }
  );
}
