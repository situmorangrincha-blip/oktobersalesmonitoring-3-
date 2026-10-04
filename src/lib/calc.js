// Semua hitungan turunan: timegone, ACV, gap, proyeksi, CA, pareto, dsb.

export const DAY_NAMES = ['', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

const sum = (a, f) => a.reduce((t, x) => t + (f ? f(x) : x), 0);
const div = (a, b) => (b ? a / b : 0);

// ---------- format ----------
export const fmt = {
  jt: (n, d = 1) => {
    const v = (n || 0) / 1e6;
    const s = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (v < 0 && Math.abs(v) >= Math.pow(10, -d) / 2 ? '-' : '') + s;
  },
  pct: (r, d = 1) => (r * 100).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%',
  int: (n) => Math.round(n || 0).toLocaleString('id-ID'),
  short: (name) => {
    const p = String(name || '').split(' ');
    return p.length > 2 ? p.slice(0, 2).join(' ') : name;
  },
};

// ---------- waktu ----------
function wibParts(now) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = f.format(now).split('-').map(Number);
  return { y, m, d };
}

const workdays = (y, m, upto) => {
  const last = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= Math.min(upto, last); d++) if (new Date(y, m - 1, d).getDay() !== 0) n++; // Senin-Sabtu
  return n;
};

const MON_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Data selalu H-1: hari kerja berjalan = hari kerja dari tgl 1 s/d kemarin.
export function timeInfo(period, override, now = new Date()) {
  const t = wibParts(now);
  const y = period?.year ?? t.y;
  const m = period?.month ?? t.m;
  const last = new Date(y, m, 0).getDate();
  const total = override?.total || workdays(y, m, last);
  let upto;
  if (t.y * 12 + t.m > y * 12 + m) upto = last; // bulan data sudah lewat
  else if (t.y * 12 + t.m < y * 12 + m) upto = 0;
  else upto = Math.min(t.d - 1, last); // H-1
  const auto = workdays(y, m, upto);
  const hk = Math.min(total, override?.hk ?? auto);
  const asOfDay = Math.max(1, Math.min(upto, last));
  return {
    y, m, total, hk, auto,
    sisa: Math.max(0, total - hk),
    tg: div(hk, total),
    asOf: upto > 0 ? `${asOfDay} ${MON_ID[m - 1]} ${y}` : '-',
    monthLabel: `${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][m - 1]} ${y}`,
    monthShort: `${MON_ID[m - 1].toUpperCase()} ${y}`,
    overridden: !!override,
  };
}

// status warna: bandingkan ACV dengan timegone
export function status(acv, tg) {
  if (tg <= 0) return 'ok';
  const r = acv / tg;
  return r >= 1 ? 'ok' : r >= 0.8 ? 'mid' : 'low';
}

// ---------- store stats ----------
export function storeStats(list) {
  const n = list.length;
  const ca = list.filter((s) => s.act >= 1).length;
  const caProd = list.filter((s) => s.act >= s.min).length;
  const act = sum(list, (s) => s.act);
  const tgt = sum(list, (s) => s.tgt);
  const lm = sum(list, (s) => s.lm);
  const l3m = sum(list, (s) => s.l3m);
  return { n, ca, caProd, caPct: div(ca, n), caProdPct: div(caProd, n), act, tgt, lm, l3m, acv: div(act, tgt) };
}

// ---------- turunan utama ----------
export function derive(data, mode, time) {
  const tg = (data.targets[mode] || data.targets.milestone) || {};
  const principals = data.principals;

  const mk = (name, tgtObj, actObj, stores) => {
    const tgt = tgtObj?.total || 0;
    const act = actObj?.total || 0;
    const acv = div(act, tgt);
    const proj = time.hk > 0 ? (act / time.hk) * time.total : 0;
    const pr = {};
    for (const p of principals) {
      const t = tgtObj?.[p] || 0;
      const a = actObj?.[p] || 0;
      pr[p] = { tgt: t, act: a, acv: div(a, t), gap: a - t };
    }
    const st = storeStats(stores);
    const pj = storeStats(stores.filter((s) => s.pj));
    const ps = storeStats(stores.filter((s) => s.ps));
    return {
      name, tgt, act, acv, gap: act - tgt,
      proj, projAcv: div(proj, tgt),
      need: div(Math.max(0, tgt - act), Math.max(1, time.sisa)),
      pr, st, pj, ps,
      lmAct: st.lm, l3mAct: st.l3m,
      vsLm: div(act, st.lm), vsL3m: div(act, st.l3m),
    };
  };

  const sales = data.salesmen.map((name) => mk(name, tg[name], data.pAct[name], data.stores.filter((s) => s.sales === name)));
  const sumPr = {};
  for (const p of principals) {
    const t = sum(sales, (x) => x.pr[p].tgt);
    const a = sum(sales, (x) => x.pr[p].act);
    sumPr[p] = { tgt: t, act: a, acv: div(a, t), gap: a - t };
  }
  const total = mk(
    'TOTAL',
    { total: sum(sales, (x) => x.tgt), ...Object.fromEntries(principals.map((p) => [p, sumPr[p].tgt])) },
    { total: sum(sales, (x) => x.act), ...Object.fromEntries(principals.map((p) => [p, sumPr[p].act])) },
    data.stores
  );
  const ranked = [...sales].sort((a, b) => b.acv - a.acv);
  ranked.forEach((s, i) => (s.rank = i + 1));
  return { sales, total, principals, mode };
}

// penjualan per hari kunjungan (SEN-SAB) untuk satu set toko
export function byRouteDay(list) {
  const r = [0, 0, 0, 0, 0, 0, 0];
  const n = [0, 0, 0, 0, 0, 0, 0];
  for (const s of list) {
    r[s.day] += s.act;
    n[s.day] += 1;
  }
  return [1, 2, 3, 4, 5, 6].map((d) => ({ day: DAY_NAMES[d], act: r[d], n: n[d] }));
}

// agregasi sub brand (kategori) untuk satu set toko
export function catAgg(data, list) {
  const rows = data.subs.map((s, i) => ({ i, ...s, cur: 0, lm: 0, l3m: 0, buyers: 0, buyersLm: 0 }));
  for (const s of list) {
    const c = data.cat.cur[s.id];
    const l = data.cat.lm[s.id];
    const m = data.cat.l3m[s.id];
    if (c) for (const [k, v] of Object.entries(c)) { rows[k].cur += v; if (v > 0) rows[k].buyers++; }
    if (l) for (const [k, v] of Object.entries(l)) { rows[k].lm += v; if (v > 0) rows[k].buyersLm++; }
    if (m) for (const [k, v] of Object.entries(m)) rows[k].l3m += v;
  }
  return rows;
}

// sub brand satu toko
export function storeCat(data, id) {
  const keys = new Set([...Object.keys(data.cat.cur[id] || {}), ...Object.keys(data.cat.lm[id] || {}), ...Object.keys(data.cat.l3m[id] || {})]);
  return [...keys]
    .map((k) => ({ ...data.subs[k], cur: data.cat.cur[id]?.[k] || 0, lm: data.cat.lm[id]?.[k] || 0, l3m: data.cat.l3m[id]?.[k] || 0 }))
    .sort((a, b) => b.cur - a.cur || b.lm - a.lm);
}

export function groupBy(list, f) {
  const m = new Map();
  for (const x of list) {
    const k = f(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// gabungkan data baru dengan data lama: bulan ini diganti, Sep & L3M tetap
export function mergeKeepHistory(oldD, newD) {
  if (!oldD) return newD;
  const key = (s) => s.id + '|' + s.sales;
  const old = new Map(oldD.stores.map((s) => [key(s), s]));
  const stores = newD.stores.map((s) => {
    const o = old.get(key(s));
    return o ? { ...s, lm: o.lm, l3m: o.l3m } : s;
  });
  // kategori: lm & l3m dari data lama untuk toko yang sudah ada, subs di-remap
  const subs = [...newD.subs];
  const idx = new Map(subs.map((s, i) => [s.p + '|' + s.n, i]));
  const remap = {};
  oldD.subs.forEach((s, i) => {
    const k = s.p + '|' + s.n;
    if (!idx.has(k)) { idx.set(k, subs.length); subs.push(s); }
    remap[i] = idx.get(k);
  });
  const cat = { cur: newD.cat.cur, lm: {}, l3m: {} };
  for (const per of ['lm', 'l3m']) {
    for (const [id, o] of Object.entries(oldD.cat[per])) {
      const t = {};
      for (const [k, v] of Object.entries(o)) t[remap[k]] = v;
      cat[per][id] = t;
    }
  }
  // toko baru (belum ada di data lama): pakai Sep & L3M dari file baru
  const oldIds = new Set(oldD.stores.map((s) => s.id));
  for (const per of ['lm', 'l3m']) {
    for (const [id, o] of Object.entries(newD.cat[per])) if (!oldIds.has(id)) cat[per][id] = o;
  }
  return { ...newD, stores, subs, cat, meta: { ...newD.meta, historyKept: true } };
}
