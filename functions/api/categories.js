/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
