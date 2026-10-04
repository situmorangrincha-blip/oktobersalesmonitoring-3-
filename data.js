// Vercel Function: simpan & ambil data dashboard (Vercel Blob), dikunci password.
import { put, list, del } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const PREFIX = 'sales-data/';

function authOk(req) {
  const want = process.env.DASH_PASSWORD || '';
  const got = String(req.headers['x-pass'] || '');
  if (!want) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const config = { api: { bodyParser: { sizeLimit: '4.4mb' } } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.DASH_PASSWORD) return res.status(500).json({ error: 'Env DASH_PASSWORD belum di-set di Vercel' });
  if (!authOk(req)) return res.status(401).json({ error: 'Password salah' });

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: PREFIX });
      if (!blobs.length) return res.status(204).end();
      const latest = [...blobs].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      const r = await fetch(latest.url, { cache: 'no-store' });
      const text = await r.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(text);
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!body || body.length < 50) return res.status(400).json({ error: 'Data kosong' });
      const saved = await put(PREFIX + 'data.json', body, { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
      const { blobs } = await list({ prefix: PREFIX });
      const old = blobs.filter((b) => b.url !== saved.url).map((b) => b.url);
      if (old.length) await del(old);
      return res.status(200).json({ ok: true, bytes: body.length });
    }
    return res.status(405).json({ error: 'Method tidak didukung' });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
