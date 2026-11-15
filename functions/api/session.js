/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { isLoggedIn } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const loggedIn = await isLoggedIn(request, env);
  return Response.json({ loggedIn });
}
