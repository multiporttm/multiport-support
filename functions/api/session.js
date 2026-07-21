import { isLoggedIn } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const loggedIn = await isLoggedIn(request, env);
  return Response.json({ loggedIn });
}
