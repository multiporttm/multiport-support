const SESSION_COOKIE = 'mp_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const cookies = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

export function isHttps(request) {
  return new URL(request.url).protocol === 'https:';
}

export function toSqlUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function parseSqlUtc(str) {
  return new Date(str.replace(' ', 'T') + 'Z');
}

export function sessionCookieHeader(request, token, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttps(request)) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookieHeader(request) {
  return sessionCookieHeader(request, '', 0);
}

export async function isLoggedIn(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return false;
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE id = ?')
    .bind(token)
    .first();
  if (!row) return false;
  return parseSqlUtc(row.expires_at) > new Date();
}

export async function createSession(env) {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  const token = crypto.randomUUID();
  const expiresAt = toSqlUtc(new Date(Date.now() + SESSION_TTL_MS));
  await env.DB.prepare('INSERT INTO sessions (id, expires_at) VALUES (?, ?)')
    .bind(token, expiresAt)
    .run();
  return { token, maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000) };
}

export async function destroySession(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
  }
}
