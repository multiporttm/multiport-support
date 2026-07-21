export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.slug, c.name, c.description,
            COUNT(t.id) AS topic_count,
            MAX(t.last_activity_at) AS last_activity_at
     FROM categories c
     LEFT JOIN topics t ON t.category_id = c.id
     GROUP BY c.id
     ORDER BY c.sort_order ASC`
  ).all();

  return Response.json(results);
}
