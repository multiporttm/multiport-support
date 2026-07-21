export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: 'invalid topic id' }, { status: 400 });
  }

  const topic = await env.DB.prepare(
    `SELECT t.id, t.title, t.body, t.author_name, t.created_at, t.reply_count,
            c.name AS category_name, c.slug AS category_slug
     FROM topics t
     JOIN categories c ON c.id = t.category_id
     WHERE t.id = ?`
  ).bind(id).first();

  if (!topic) {
    return Response.json({ error: 'topic not found' }, { status: 404 });
  }

  const { results: replies } = await env.DB.prepare(
    `SELECT id, body, author_name, created_at
     FROM replies
     WHERE topic_id = ?
     ORDER BY created_at ASC`
  ).bind(id).all();

  return Response.json({ topic, replies });
}
