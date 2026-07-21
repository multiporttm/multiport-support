export async function onRequestGet({ env }) {
  if (!env.VAPID_PUBLIC_KEY) {
    return Response.json({ error: 'Push notifications are not configured.' }, { status: 500 });
  }
  return Response.json({ publicKey: env.VAPID_PUBLIC_KEY });
}
