const STORE_KEY = 'oracle-global-v1';
const EMPTY = { keys: [], reactivated: [], eas: [] };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
}

async function readStore(env) {
  const raw = await env.ORACLE_STORE.get(STORE_KEY);
  if (!raw) return { ...EMPTY, keys: [], reactivated: [], eas: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      keys: Array.isArray(parsed.keys) ? parsed.keys : [],
      reactivated: Array.isArray(parsed.reactivated) ? parsed.reactivated : [],
      eas: Array.isArray(parsed.eas) ? parsed.eas : [],
    };
  } catch {
    return { ...EMPTY, keys: [], reactivated: [], eas: [] };
  }
}

async function writeStore(env, data) {
  const payload = {
    keys: data.keys || [],
    reactivated: data.reactivated || [],
    eas: data.eas || [],
    updatedAt: new Date().toISOString(),
  };
  await env.ORACLE_STORE.put(STORE_KEY, JSON.stringify(payload));
  return payload;
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders();
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (request.method === 'GET' && (path === '/' || path === '/store')) {
        const store = await readStore(env);
        return new Response(JSON.stringify(store), { headers });
      }

      if (request.method === 'PUT' && (path === '/' || path === '/store')) {
        const body = await request.json();
        const saved = await writeStore(env, body);
        return new Response(JSON.stringify(saved), { headers });
      }

      // Merge helpers for safer concurrent updates
      if (request.method === 'POST' && path === '/keys') {
        const body = await request.json();
        const store = await readStore(env);
        const entry = body.key || body;
        if (!entry || !entry.key || !entry.id) {
          return new Response(JSON.stringify({ error: 'key object required' }), {
            status: 400,
            headers,
          });
        }
        // Never store bulky images on keys
        const slim = { ...entry, eaImageUri: null };
        store.keys = [slim, ...store.keys.filter((k) => k.id !== slim.id && k.key !== slim.key)];
        const saved = await writeStore(env, store);
        return new Response(JSON.stringify({ ok: true, key: slim, store: saved }), { headers });
      }

      if (request.method === 'POST' && path === '/reactivated') {
        const body = await request.json();
        const store = await readStore(env);
        const entry = body.email ? body : body.entry;
        if (!entry || !entry.email) {
          return new Response(JSON.stringify({ error: 'email entry required' }), {
            status: 400,
            headers,
          });
        }
        const email = String(entry.email).trim().toLowerCase();
        store.reactivated = [
          { ...entry, email },
          ...store.reactivated.filter((e) => e.email !== email),
        ];
        const saved = await writeStore(env, store);
        return new Response(JSON.stringify({ ok: true, store: saved }), { headers });
      }

      if (request.method === 'POST' && path === '/eas') {
        const body = await request.json();
        const store = await readStore(env);
        const entry = body.ea || body;
        if (!entry || !entry.id || !entry.name) {
          return new Response(JSON.stringify({ error: 'ea object required' }), {
            status: 400,
            headers,
          });
        }
        // Cap image size: if data URL > 200kb, drop image (keep metadata)
        let imageUri = entry.imageUri ?? null;
        if (typeof imageUri === 'string' && imageUri.length > 200000) {
          imageUri = null;
        }
        const slim = { ...entry, imageUri };
        store.eas = [slim, ...store.eas.filter((e) => e.id !== slim.id)];
        const saved = await writeStore(env, store);
        return new Response(JSON.stringify({ ok: true, ea: slim, store: saved }), { headers });
      }

      if (request.method === 'POST' && path === '/activate') {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const keyCode = String(body.key || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
        const dashed =
          keyCode.length === 12
            ? `${keyCode.slice(0, 3)}-${keyCode.slice(3, 6)}-${keyCode.slice(6, 9)}-${keyCode.slice(9, 12)}`
            : body.key;
        const store = await readStore(env);
        const found = store.keys.find((k) => {
          const compact = String(k.key || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
          return compact === keyCode;
        });
        if (!found) {
          return new Response(
            JSON.stringify({
              ok: false,
              reason:
                store.keys.length === 0
                  ? 'No license keys found. Ask your admin to generate a key in Create keys.'
                  : 'Invalid robot key. Check with your mentor.',
              catalogCount: store.keys.length,
            }),
            { headers },
          );
        }
        if (!found.eaId || !found.eaName) {
          return new Response(
            JSON.stringify({
              ok: false,
              reason:
                'This key is not linked to an EA. Ask your admin to create the key against an expert advisor.',
              catalogCount: store.keys.length,
            }),
            { headers },
          );
        }
        // Bind email
        found.boundEmail = email;
        store.keys = store.keys.map((k) => (k.id === found.id ? { ...k, boundEmail: email } : k));
        // Activation record stored on key for simplicity; also track on reactivated if present
        const saved = await writeStore(env, store);
        const ea = store.eas.find((e) => e.id === found.eaId) || null;
        return new Response(
          JSON.stringify({
            ok: true,
            key: found,
            ea: ea
              ? { id: ea.id, name: ea.name, imageUri: ea.imageUri ?? null }
              : { id: found.eaId, name: found.eaName, imageUri: null },
            catalogCount: saved.keys.length,
          }),
          { headers },
        );
      }

      return new Response(JSON.stringify({ error: 'not found', path }), { status: 404, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err && err.message ? err.message : err) }), {
        status: 500,
        headers,
      });
    }
  },
};
