import { isLoggedIn } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const loggedIn = await isLoggedIn(request, env);
  if (!loggedIn) {
    return Response.json({ error: 'Log in as Developer to enable notifications.' }, { status: 401 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const endpoint = String(data.endpoint || '');
  const p256dh = data.keys && String(data.keys.p256dh || '');
  const auth = data.keys && String(data.keys.auth || '');

  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: 'endpoint and keys.p256dh/keys.auth are required' }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
  ).bind(endpoint, p256dh, auth).run();

  return Response.json({ ok: true }, { status: 201 });
}
