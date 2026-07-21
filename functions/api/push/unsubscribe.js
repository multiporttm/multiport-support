export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const endpoint = String(data.endpoint || '');
  if (!endpoint) {
    return Response.json({ error: 'endpoint is required' }, { status: 400 });
  }

  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
  return Response.json({ ok: true });
}
