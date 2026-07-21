export const VAPID_PUBLIC_KEY = 'BMoS90XMSRMjm6BzboubQUimZrgBFHkTNO13Ik9FCB-I1e8F1Ovjg21bcxOq7bkPDJV39ZFT85autX59nVomP6A';

const VAPID_PRIVATE_KEY_JWK = {
  key_ops: ['sign'],
  ext: true,
  kty: 'EC',
  x: 'yhL3RcxJEyOboHNui5tBSKZmuAEUeRM07XciT0UIH4g',
  y: '1e8F1Ovjg21bcxOq7bkPDJV39ZFT85autX59nVomP6A',
  crv: 'P-256',
  d: 'hlWgBuS3b8agMH9wGQm8rEkXA6aclNlheqgEbItqa3s',
};

const VAPID_SUBJECT = 'mailto:admin@multiportllc.com';

function b64urlEncode(bytes) {
  let str = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(sig);
}

async function buildVapidHeader(endpoint) {
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: expiration, sub: VAPID_SUBJECT };

  const encoder = new TextEncoder();
  const headerB64 = b64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signKey = await crypto.subtle.importKey(
    'jwk', VAPID_PRIVATE_KEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, signKey, encoder.encode(signingInput)
  );

  const jwt = `${signingInput}.${b64urlEncode(signature)}`;
  return `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`;
}

// Encrypts `payload` per RFC 8291 (aes128gcm) for a single push subscriber.
async function encryptPayload(subscription, payload) {
  const uaPublicKeyBytes = b64urlDecode(subscription.p256dh);
  const authSecret = b64urlDecode(subscription.auth);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey));

  const uaPublicKey = await crypto.subtle.importKey(
    'raw', uaPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, asKeyPair.privateKey, 256)
  );

  const encoder = new TextEncoder();
  const authInfo = concatBytes(encoder.encode('WebPush: info\0'), uaPublicKeyBytes, asPublicKeyBytes);

  const prkCombine = await hmacSha256(authSecret, sharedSecret);
  const ikm = (await hmacSha256(prkCombine, concatBytes(authInfo, new Uint8Array([1])))).slice(0, 32);

  const prk = await hmacSha256(salt, ikm);

  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const cek = (await hmacSha256(prk, concatBytes(cekInfo, new Uint8Array([1])))).slice(0, 16);

  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const nonce = (await hmacSha256(prk, concatBytes(nonceInfo, new Uint8Array([1])))).slice(0, 12);

  const plaintext = encoder.encode(JSON.stringify(payload));
  const padded = concatBytes(plaintext, new Uint8Array([2])); // 0x02 = last (and only) record

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded)
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const idLen = new Uint8Array([asPublicKeyBytes.length]);

  const header = concatBytes(salt, recordSize, idLen, asPublicKeyBytes);
  return concatBytes(header, ciphertext);
}

// Sends a push message to one subscriber. Returns true on success, false if
// the subscription is gone (404/410) and should be deleted by the caller.
export async function sendWebPush(subscription, payload) {
  const body = await encryptPayload(subscription, payload);
  const authHeader = await buildVapidHeader(subscription.endpoint);

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Authorization: authHeader,
    },
    body,
  });

  if (res.status === 404 || res.status === 410) {
    return { ok: false, gone: true };
  }
  return { ok: res.ok, gone: false };
}

// Fire-and-forget notify of every stored subscriber; prunes dead ones.
export async function notifySubscribers(env, payload) {
  const { results } = await env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions'
  ).all();

  await Promise.all(results.map(async (sub) => {
    try {
      const result = await sendWebPush(sub, payload);
      if (result.gone) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
      }
    } catch {
      // best-effort; a single failed subscriber shouldn't break the rest
    }
  }));
}
