import { VAPID_PUBLIC_KEY } from '../_push.js';

export async function onRequestGet() {
  return Response.json({ publicKey: VAPID_PUBLIC_KEY });
}
