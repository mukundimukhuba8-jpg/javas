/**
 * Upload an EA image to Supabase Storage with the service role (bypasses RLS).
 * Used by Pages + Vercel clients — never expose SUPABASE_SECRET_KEY to the browser.
 *
 * POST JSON: { eaId?: string, contentType?: string, dataBase64: string }
 * → { url: "https://…/storage/v1/object/public/oracle/ea-images/…" }
 */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const secret = process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !secret) {
    json(res, 503, { error: 'supabase_secret_not_configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const dataBase64 = body && typeof body.dataBase64 === 'string' ? body.dataBase64 : '';
  if (!dataBase64 || dataBase64.length < 32) {
    json(res, 400, { error: 'missing_dataBase64' });
    return;
  }
  if (dataBase64.length > 2_500_000) {
    json(res, 413, { error: 'image_too_large' });
    return;
  }

  const eaId = String((body && body.eaId) || 'ea')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48) || 'ea';
  const contentType =
    body && typeof body.contentType === 'string' && body.contentType.startsWith('image/')
      ? body.contentType
      : 'image/jpeg';
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg';
  const path = `ea-images/${eaId}-${Date.now().toString(36)}.${ext}`;

  try {
    const buf = Buffer.from(dataBase64, 'base64');
    const up = await fetch(`${url}/storage/v1/object/oracle/${path}`, {
      method: 'POST',
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buf,
    });
    if (!up.ok) {
      const text = await up.text();
      json(res, 502, {
        error: 'storage_upload_failed',
        status: up.status,
        detail: String(text).slice(0, 180),
      });
      return;
    }
    const publicUrl = `${url}/storage/v1/object/public/oracle/${path}`;
    json(res, 200, { url: publicUrl, path });
  } catch (e) {
    json(res, 500, {
      error: 'upload_exception',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
};
