import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/lib/parse.js';
const f = process.argv[2] || '/mnt/user-data/uploads/OKTOBER_SALES_MONITORING__1_.xlsx';
const t0 = Date.now();
const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer', cellFormula: false, cellStyles: false });
const d = parseWorkbook(wb, { fileName: f });
console.log('parse ms', Date.now() - t0);
console.log('period', d.meta.period, 'salesmen', d.salesmen);
console.log('principals', d.principals);
console.log('warnings', d.warnings);
console.log('stores', d.stores.length, 'subs', d.subs.length, 'cat cur/lm/l3m', Object.keys(d.cat.cur).length, Object.keys(d.cat.lm).length, Object.keys(d.cat.l3m).length);
const fmt = (n) => Math.round(n).toLocaleString('id-ID');
for (const s of d.salesmen) {
  const st = d.stores.filter((x) => x.sales === s);
  console.log(s.padEnd(26), 'n', st.length, 'actStore', fmt(st.reduce((a, x) => a + x.act, 0)), 'pivot', fmt(d.pAct[s].total), 'tgtM', fmt(d.targets.milestone[s].total), 'tgtB', fmt(d.targets.bti[s].total),
    'CA', st.filter((x) => x.act >= 1).length, 'CAprod', st.filter((x) => x.act >= x.min).length, 'pj', st.filter((x) => x.pj).length, 'ps', st.filter((x) => x.ps).length);
}
console.log('CA total', d.stores.filter((x) => x.act >= 1).length, 'CAprod', d.stores.filter((x) => x.act >= x.min).length, 'SAK', d.stores.filter((x) => x.ps).length, 'PJ', d.stores.filter((x) => x.pj).length);
console.log('sum store tgt', fmt(d.stores.reduce((a, x) => a + x.tgt, 0)), 'LM', fmt(d.stores.reduce((a, x) => a + x.lm, 0)), 'L3M/mo', fmt(d.stores.reduce((a, x) => a + x.l3m, 0)));
const json = JSON.stringify(d);
console.log('json KB', Math.round(json.length / 1024));
fs.writeFileSync('/tmp/data.json', json);
console.log(d.subs.slice(0, 5));
