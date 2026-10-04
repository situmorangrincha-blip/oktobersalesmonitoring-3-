// Penyimpanan data: API Vercel (cloud) kalau ada, kalau tidak (dev lokal) pakai IndexedDB browser.
const DB = 'target-quest';
const KEY = 'data';

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function localGet() {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction('kv').objectStore('kv').get(KEY);
    q.onsuccess = () => res(q.result || null);
    q.onerror = () => rej(q.error);
  });
}
async function localSet(v) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(v, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export const getPass = () => localStorage.getItem('tq_pass') || '';
export const setPass = (p) => localStorage.setItem('tq_pass', p);

// return { mode: 'cloud'|'local', data|null } atau throw { code: 401 }
export async function loadData() {
  let r;
  try {
    r = await fetch('/api/data', { headers: { 'x-pass': getPass() } });
  } catch {
    r = null;
  }
  const ct = r?.headers.get('content-type') || '';
  if (!r || r.status === 404 || (r.ok && !ct.includes('json') && r.status !== 204)) {
    return { mode: 'local', data: await localGet() };
  }
  if (r.status === 401) throw { code: 401 };
  if (r.status === 204) return { mode: 'cloud', data: null };
  if (!r.ok) throw { code: r.status, message: (await r.json().catch(() => ({}))).error || 'Gagal memuat data' };
  return { mode: 'cloud', data: await r.json() };
}

export async function saveData(mode, data) {
  if (mode === 'local') return localSet(data);
  const body = JSON.stringify(data);
  if (body.length > 4.3e6) throw new Error('Data terlalu besar (>4,3 MB) untuk disimpan');
  const r = await fetch('/api/data', { method: 'PUT', headers: { 'x-pass': getPass(), 'content-type': 'application/json' }, body });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Gagal simpan (${r.status})`);
}
