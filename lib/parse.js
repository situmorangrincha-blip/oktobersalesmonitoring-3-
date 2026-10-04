// Parser Excel -> JSON. Cari posisi data lewat LABEL, bukan nomor cell,
// jadi geser baris/kolom sedikit tidak bikin rusak.
import * as XLSX from 'xlsx';

const norm = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
const str = (v) => (v == null ? '' : String(v).trim());
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const rp = (v) => Math.round(num(v));

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_ID = { MEI: 'MAY', AGU: 'AUG', AGT: 'AUG', OKT: 'OCT', DES: 'DEC' };

function grid(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

function findCell(g, pred, r0 = 0, r1 = g.length) {
  for (let r = r0; r < Math.min(r1, g.length); r++) {
    const row = g[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) if (row[c] != null && pred(row[c], r, c)) return { r, c };
  }
  return null;
}

export function parsePeriod(v) {
  const m = String(v ?? '').toUpperCase().match(/([A-Z]{3})[A-Z]*\W*(\d{4})/);
  if (!m) return null;
  const mon = MONTHS_ID[m[1]] || m[1];
  const mi = MONTHS.indexOf(mon);
  if (mi < 0) return null;
  return { year: +m[2], month: mi + 1, key: +m[2] * 12 + mi, label: `${m[1]} ${m[2]}` };
}

function periodAbove(g, r, c) {
  for (let rr = r - 1; rr >= Math.max(0, r - 18); rr--) {
    if (norm(g[rr]?.[c]) === 'PERIOD YMWD') return g[rr][c + 1];
  }
  return null;
}

function sheetByName(wb) {
  const out = {};
  for (const name of wb.SheetNames) {
    const n = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (n.includes('RECAP')) out.recap = name;
    else if (n === 'TGT') out.tgt = name;
    else if (n.includes('FOCUSCATEGORY')) out.cat = name;
    else if (n.startsWith('OLAPSALES')) out.sales = name;
    else if (n === 'LAB') out.lab = name;
    else if (n.includes('JKS')) out.jks = name;
  }
  return out;
}

// ---------- (LOOK) RECAPT: cuma ambil daftar salesman tim ----------
function parseRecap(g) {
  const h = findCell(g, (v) => norm(v) === 'ALL SALES PERFORMANCE');
  if (!h) throw new Error('Sheet RECAPT: tulisan "ALL SALES PERFORMANCE" tidak ketemu');
  const names = [];
  for (let r = h.r + 2; r < g.length; r++) {
    const v = str(g[r]?.[h.c]);
    if (!v || norm(v) === 'GRAND TOTAL') break;
    names.push(v);
  }
  if (!names.length) throw new Error('Sheet RECAPT: daftar salesman kosong');
  return names;
}

// ---------- TGT: target milestone & BTI ----------
function principalBase(h) {
  const x = h.replace(/^T\s+/i, '').trim().toUpperCase();
  const m = x.match(/^(.+?)[-\s][AB]$/); // GPPJ-A, MBR A -> GPPJ, MBR (FLORA tetap FLORA)
  return m ? m[1] : x;
}

function parseTarget(g, title) {
  const t = findCell(g, (v) => norm(v) === title);
  if (!t) return null;
  const hr = t.r + 1;
  const head = g[hr] || [];
  const nameCol = head.findIndex((v) => norm(v) === 'ROW LABELS');
  if (nameCol < 0) return null;
  const cols = [];
  for (let c = nameCol + 1; c < head.length; c++) {
    const h = str(head[c]);
    if (h) cols.push({ c, h, up: norm(h) });
  }
  const out = {};
  for (let r = hr + 1; r < g.length; r++) {
    const name = str(g[r]?.[nameCol]);
    if (!name || norm(name) === 'GRAND TOTAL') break;
    const o = { total: 0 };
    let sum = 0;
    for (const { c, h, up } of cols) {
      if (up.includes('TOTAL') || up.includes('SHARE')) continue;
      const v = num(g[r][c]);
      const b = principalBase(h);
      o[b] = (o[b] || 0) + v;
      sum += v;
    }
    const tc = cols.find((x) => x.up.includes('TOTAL'));
    o.total = tc ? num(g[r][tc.c]) : sum;
    if (!o.total) o.total = sum;
    out[name] = o;
  }
  return out;
}

// ---------- OLAP SALES ----------
function parsePivotSalesman(g) {
  const p = findCell(g, (v, r, c) => norm(v) === 'PRINCIPAL' && norm(g[r]?.[c - 1]) === 'NETSALESPKD', 0, 60);
  if (!p) throw new Error('Sheet OLAP SALES: pivot salesman x principal tidak ketemu');
  const nameCol = p.c - 1;
  const hr = p.r + 1;
  const heads = [];
  for (let c = p.c; c < (g[hr]?.length || 0); c++) {
    const h = str(g[hr][c]);
    if (!h) break;
    heads.push({ c, h });
  }
  const out = {};
  for (let r = hr + 1; r < g.length; r++) {
    const name = str(g[r]?.[nameCol]);
    if (!name || norm(name) === 'GRAND TOTAL') break;
    const o = {};
    let tot = 0;
    for (const { c, h } of heads) {
      const v = num(g[r][c]);
      if (norm(h) === 'GRAND TOTAL') tot = v;
      else o[norm(h)] = v;
    }
    o.total = tot || Object.values(o).reduce((a, b) => a + b, 0);
    out[name] = o;
  }
  return { pAct: out, principals: heads.map((x) => norm(x.h)).filter((x) => x !== 'GRAND TOTAL') };
}

function findOutletBlocks(g) {
  const blocks = [];
  for (let r = 0; r < Math.min(60, g.length); r++) {
    const row = g[r] || [];
    for (let c = 0; c < row.length - 2; c++) {
      if (norm(row[c]) === 'SZNAME' && norm(row[c + 1]) === 'SZCUSTID' && norm(row[c + 2]) === 'NETSALESPKD') {
        blocks.push({ r, c, hasAvg: norm(row[c + 3]) === 'L3M /MONTH', period: periodAbove(g, r, c) });
      }
    }
  }
  return blocks;
}

// beri label cur / lm / l3m ke blok-blok berdasarkan periode
function classify(blocks) {
  const l3m = blocks.find((b) => b.hasAvg || /MULTIPLE/i.test(String(b.period ?? '')));
  const rest = blocks.filter((b) => b !== l3m);
  rest.forEach((b) => (b.p = parsePeriod(b.period)));
  rest.sort((a, b) => (b.p?.key ?? -1) - (a.p?.key ?? -1) || a.c - b.c);
  const hasPeriods = rest.every((b) => b.p);
  const ordered = hasPeriods ? rest : [...rest].sort((a, b) => a.c - b.c);
  return { cur: ordered[0], lm: ordered[1], l3m };
}

function readOutlets(g, b) {
  const m = {};
  for (let r = b.r + 1; r < g.length; r++) {
    const id = str(g[r]?.[b.c + 1]);
    const nm = str(g[r]?.[b.c]);
    if (!id || norm(nm) === 'GRAND TOTAL') break;
    const v = b.hasAvg ? num(g[r][b.c + 3]) : num(g[r][b.c + 2]);
    m[id] = (m[id] || 0) + v;
  }
  return m;
}

// ---------- OLAP FOCUS CATEGORY (principal > sub brand per toko) ----------
function readCat(g, b, divide = 1) {
  const head = g[b.r] || [];
  const pr = g[b.r - 1] || [];
  const cols = [];
  for (let c = b.c + 2; c < head.length; c++) {
    const p = str(pr[c]);
    if (norm(p) === 'GRAND TOTAL') break;
    const h = str(head[c]);
    if (!h && !p) break;
    if (h) cols.push({ c, sub: h, principal: norm(p) || 'LAINNYA' });
  }
  const rows = {};
  for (let r = b.r + 1; r < g.length; r++) {
    const id = str(g[r]?.[b.c + 1]);
    const nm = str(g[r]?.[b.c]);
    if (!id || norm(nm) === 'GRAND TOTAL') break;
    const o = rows[id] || (rows[id] = {});
    for (const { c, sub, principal } of cols) {
      const v = num(g[r][c]);
      if (v) {
        const k = principal + '|' + sub;
        o[k] = (o[k] || 0) + v / divide;
      }
    }
  }
  return { cols, rows };
}

// ---------- JKS & LAB ----------
function headerRow(g, must) {
  for (let r = 0; r < Math.min(40, g.length); r++) {
    const row = (g[r] || []).map(norm);
    if (must.every((m) => row.includes(m))) {
      const idx = {};
      row.forEach((h, i) => h && idx[h] === undefined && (idx[h] = i));
      return { r, idx };
    }
  }
  return null;
}

const DAYS = [['SENIN', 1], ['SELASA', 2], ['RABU', 3], ['KAMIS', 4], ['JUMAT', 5], ['SABTU', 6]];
const dayOf = (s) => {
  const u = String(s || '').toUpperCase();
  for (const [d, i] of DAYS) if (u.includes(d)) return i;
  return 0;
};

export function parseWorkbook(wb, meta = {}) {
  const warnings = [];
  const sh = sheetByName(wb);
  for (const [k, label] of [['recap', '(LOOK)RECAPT'], ['tgt', 'TGT'], ['sales', 'OLAP SALES'], ['jks', 'JKS SALESMAN']]) {
    if (!sh[k]) throw new Error(`Sheet "${label}" tidak ditemukan di file`);
  }
  if (!sh.lab) warnings.push('Sheet LAB tidak ada: target toko, min CA produktif & flag pareto kosong');
  if (!sh.cat) warnings.push('Sheet OLAP FOCUS CATEGORY tidak ada: tampilan kategori/SKU per toko kosong');
  const G = (k) => grid(wb.Sheets[sh[k]]);

  const salesmen = parseRecap(G('recap'));
  const gt = G('tgt');
  const milestone = parseTarget(gt, 'TARGET MILESTONE');
  const bti = parseTarget(gt, 'TARGET BTI');
  if (!milestone) throw new Error('Sheet TGT: blok "TARGET MILESTONE" tidak ketemu');
  if (!bti) warnings.push('Sheet TGT: blok "TARGET BTI" tidak ketemu, pilihan BTI dimatikan');
  const pick = (t) => {
    const o = {};
    for (const s of salesmen) {
      if (t && t[s]) o[s] = t[s];
      else if (t) warnings.push(`Target "${s}" tidak ada di TGT`);
    }
    return o;
  };

  const gs = G('sales');
  const { pAct, principals: pActPrincipals } = parsePivotSalesman(gs);
  const pActTeam = {};
  for (const s of salesmen) {
    if (pAct[s]) pActTeam[s] = pAct[s];
    else warnings.push(`Salesman "${s}" belum ada di pivot OLAP SALES (anggap ACT 0)`);
  }
  const rg = findCell(gs, (v) => norm(v) === 'REGION', 0, 60);
  const region = rg ? str(gs[rg.r]?.[rg.c + 1]).replace(/^\d+\s*-\s*/, '') : '';
  const ob = classify(findOutletBlocks(gs));
  if (!ob.cur) throw new Error('Sheet OLAP SALES: pivot per outlet (bulan ini) tidak ketemu');
  const octMap = readOutlets(gs, ob.cur);
  const lmMap = ob.lm ? readOutlets(gs, ob.lm) : {};
  const l3mMap = ob.l3m ? readOutlets(gs, ob.l3m) : {};
  if (!ob.lm) warnings.push('Pivot bulan lalu per outlet tidak ketemu');
  if (!ob.l3m) warnings.push('Pivot L3M per outlet tidak ketemu');
  const period = ob.cur.p || parsePeriod(ob.cur.period);
  if (!period) warnings.push('Periode bulan berjalan tidak terbaca, dipakai bulan dari tanggal hari ini');

  // JKS
  const gj = G('jks');
  const hj = headerRow(gj, ['ID PELANGGAN', 'NAMA SALESMAN']);
  if (!hj) throw new Error('Sheet JKS SALESMAN: header "Id Pelanggan" / "Nama Salesman" tidak ketemu');
  const J = hj.idx;
  const team = new Set(salesmen.map(norm));
  const rows = [];
  for (let r = hj.r + 1; r < gj.length; r++) {
    const row = gj[r];
    const id = str(row?.[J['ID PELANGGAN']]);
    const sales = str(row?.[J['NAMA SALESMAN']]);
    if (!id || !team.has(norm(sales))) continue;
    rows.push({
      id,
      name: str(row[J['NAMA PELANGGAN']]),
      sales: salesmen.find((s) => norm(s) === norm(sales)),
      hk: str(row[J['HARI KUNJ']]),
      day: dayOf(row[J['HARI KUNJ']]),
      cc1: str(row[J['CC1']]) || '-',
      cc2: str(row[J['CC2']]) || '-',
      cc3: str(row[J['CC3']]) || '-',
      tipe: str(row[J['TIPE SALES']]),
      kec: str(row[J['KECAMATAN']]),
      kel: str(row[J['KELURAHAN']]),
    });
  }
  if (!rows.length) throw new Error('Sheet JKS SALESMAN: tidak ada toko milik salesman di RECAPT');

  // LAB
  const lab = {};
  const labById = {};
  if (sh.lab) {
    const gl = G('lab');
    const hl = headerRow(gl, ['ID PELANGGAN', 'NAMA SALESMAN', 'TGT']);
    if (hl) {
      const L = hl.idx;
      for (let r = hl.r + 1; r < gl.length; r++) {
        const row = gl[r];
        const id = str(row?.[L['ID PELANGGAN']]);
        if (!id) continue;
        const rec = {
          min: num(row[L['MINIMUM PROD']]),
          pj: norm(row[L['PARETO JKS']]) === 'PARETO JKS',
          ps: ['PARETO JKS', 'PARETO SAK'].includes(norm(row[L['PARETO SAK']])),
          tgt: num(row[L['TGT']]),
        };
        lab[id + '|' + norm(row[L['NAMA SALESMAN']])] = rec;
        labById[id] = rec;
      }
    } else warnings.push('Sheet LAB: header tidak lengkap (butuh Id Pelanggan, Nama Salesman, TGT)');
  }

  const stores = rows.map((s) => {
    const l = lab[s.id + '|' + norm(s.sales)] || labById[s.id] || {};
    const wholesale = /WHOLESAL/i.test(s.tipe);
    return {
      ...s,
      min: l.min || (wholesale ? 1000000 : 200000),
      pj: !!l.pj,
      ps: !!l.ps,
      tgt: rp(l.tgt),
      act: rp(octMap[s.id]),
      lm: rp(lmMap[s.id]),
      l3m: rp(l3mMap[s.id]),
    };
  });

  const noMin = rows.filter((s) => !((lab[s.id + '|' + norm(s.sales)] || labById[s.id] || {}).min > 0)).length;
  if (noMin) warnings.push(`Info: ${noMin} toko belum punya Minimum CA Prod di LAB, dipakai default (retail 200rb, grosir 1jt)`);

  // kategori / sub brand per toko (hanya toko tim, biar file kecil)
  const subs = [];
  const subIdx = {};
  const catOut = { cur: {}, lm: {}, l3m: {} };
  if (sh.cat) {
    const gc = G('cat');
    const cb = classify(findOutletBlocksCat(gc));
    const ids = new Set(stores.map((s) => s.id));
    for (const [lab2, b, div] of [['cur', cb.cur, 1], ['lm', cb.lm, 1], ['l3m', cb.l3m, 3]]) {
      if (!b) {
        warnings.push(`Pivot kategori (${lab2}) tidak ketemu`);
        continue;
      }
      const { rows: cr } = readCat(gc, b, div);
      for (const [id, o] of Object.entries(cr)) {
        if (!ids.has(id)) continue;
        const t = {};
        for (const [k, v] of Object.entries(o)) {
          if (subIdx[k] === undefined) {
            const [p, n] = k.split('|');
            subIdx[k] = subs.length;
            subs.push({ p, b: n.split(' ')[0], n });
          }
          t[subIdx[k]] = Math.round(v);
        }
        catOut[lab2][id] = t;
      }
    }
  }

  // cek silang
  const actStores = stores.reduce((a, s) => a + s.act, 0);
  const actPivot = Object.values(pActTeam).reduce((a, o) => a + (o.total || 0), 0);
  if (Math.abs(actStores - actPivot) > Math.max(1000, actPivot * 0.001)) {
    warnings.push(
      `ACT per toko (${Math.round(actStores).toLocaleString('id-ID')}) beda dengan pivot salesman (${Math.round(actPivot).toLocaleString('id-ID')}): ` +
        'kemungkinan ada toko tidak terdaftar di JKS tim'
    );
  }

  for (const sName of salesmen) {
    const a = stores.filter((x) => x.sales === sName).reduce((t, x) => t + x.act, 0);
    const b = pActTeam[sName]?.total || 0;
    if (Math.abs(a - b) > 100000) {
      warnings.push(`Info: ACT ${sName} di pivot ${Math.round(b).toLocaleString('id-ID')} vs total tokonya di JKS ${Math.round(a).toLocaleString('id-ID')} (ada toko yang dijual salesman lain)`);
    }
  }

  const principals = [...new Set([...pActPrincipals, ...Object.values(pick(milestone)).flatMap((o) => Object.keys(o).filter((k) => k !== 'total' && o[k] > 0))])];

  return {
    v: 1,
    meta: {
      period: period ? { year: period.year, month: period.month, label: period.label } : null,
      uploadedAt: meta.uploadedAt || new Date().toISOString(),
      fileName: meta.fileName || '',
      region,
      hasBti: !!bti,
      actStores,
      actPivot,
    },
    salesmen,
    principals,
    targets: { milestone: pick(milestone), bti: bti ? pick(bti) : null },
    pAct: pActTeam,
    stores,
    subs,
    cat: catOut,
    warnings,
  };
}

function findOutletBlocksCat(g) {
  const blocks = [];
  for (let r = 0; r < Math.min(60, g.length); r++) {
    const row = g[r] || [];
    for (let c = 0; c < row.length - 1; c++) {
      if (norm(row[c]) === 'SZNAME' && norm(row[c + 1]) === 'SZCUSTID') {
        const period = periodAbove(g, r, c);
        blocks.push({ r, c, hasAvg: /MULTIPLE/i.test(String(period ?? '')), period });
      }
    }
  }
  return blocks;
}
