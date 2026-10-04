import { useMemo, useState } from 'react';
import { fmt, status } from '../lib/calc.js';
import { Bar, Panel, Seg, useSorted } from '../components/ui.jsx';
import SalFilter from '../components/SalFilter.jsx';

const FILTERS = [
  { v: 'all', label: 'Semua' },
  { v: 'ca', label: 'CA' },
  { v: 'nonca', label: 'Belum CA' },
  { v: 'prod', label: 'CA Prod' },
  { v: 'pj', label: 'Pareto JKS' },
  { v: 'ps', label: 'Pareto SAK' },
];

export function StoreFlags({ s }) {
  return (
    <>
      {s.act >= s.min ? <span className="tag g">PROD</span> : s.act >= 1 ? <span className="tag y">CA</span> : <span className="tag r">NO</span>}
      {s.pj && <span className="tag b">PJ</span>}
      {s.ps && <span className="tag b">SAK</span>}
    </>
  );
}

export function StoreTable({ list, time, onStore, limit = 40, defKey = 'tgt', showSales = true, compact = false }) {
  const [more, setMore] = useState(1);
  const { rows, th } = useSorted(list, defKey, -1);
  const shown = rows.slice(0, limit * more);
  return (
    <>
      <div className="scroll">
        <table className="t">
          <thead>
            <tr>
              {th('name', 'Toko', 'l')}
              {showSales && th('sales', 'Salesman', 'l')}
              {!compact && th('cc2', 'Channel', 'l')}
              {th('tgt', 'TGT')}
              {th('act', 'ACT')}
              {th((s) => (s.tgt ? s.act / s.tgt : 0), 'ACV')}
              {th('lm', 'SEP')}
              {!compact && th('l3m', 'L3M')}
              <th className="l">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const acv = s.tgt ? s.act / s.tgt : 0;
              return (
                <tr key={s.id + s.sales} className="clickable" data-sfx="pick" onClick={() => onStore(s)}>
                  <td className="nm">{s.name}</td>
                  {showSales && <td className="l nm mut">{fmt.short(s.sales)}</td>}
                  {!compact && <td className="l nm mut">{s.cc2}</td>}
                  <td>{fmt.jt(s.tgt, 2)}</td>
                  <td>{fmt.jt(s.act, 2)}</td>
                  <td className={s.tgt ? status(acv, time.tg) : 'mut'}>{s.tgt ? fmt.pct(acv, 0) : '-'}</td>
                  <td>{fmt.jt(s.lm, 2)}</td>
                  {!compact && <td>{fmt.jt(s.l3m, 2)}</td>}
                  <td className="l"><StoreFlags s={s} /></td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={compact ? 6 : 9} className="mut" style={{ textAlign: 'center', padding: 20 }}>Tidak ada toko yang cocok</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <div style={{ padding: 10, textAlign: 'center' }}>
          <button className="btn sm" onClick={() => setMore(more + 1)}>Muat {Math.min(limit, rows.length - shown.length)} lagi ({rows.length - shown.length} sisa)</button>
        </div>
      )}
    </>
  );
}

export default function Stores({ data, time, sal, setSal, onStore }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [ch, setCh] = useState('ALL');
  const channels = useMemo(() => [...new Set(data.stores.map((s) => s.cc2))].sort(), [data]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.stores.filter((s) => {
      if (sal !== 'ALL' && s.sales !== sal) return false;
      if (ch !== 'ALL' && s.cc2 !== ch) return false;
      if (f === 'ca' && s.act < 1) return false;
      if (f === 'nonca' && s.act >= 1) return false;
      if (f === 'prod' && s.act < s.min) return false;
      if (f === 'pj' && !s.pj) return false;
      if (f === 'ps' && !s.ps) return false;
      if (t && !(s.name.toLowerCase().includes(t) || s.id.includes(t))) return false;
      return true;
    });
  }, [data, sal, q, f, ch]);
  const act = list.reduce((a, s) => a + s.act, 0);
  const tgt = list.reduce((a, s) => a + s.tgt, 0);
  return (
    <>
      <div className="tabs-row">
        <input className="input" placeholder="Cari nama / ID toko" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={ch} onChange={(e) => setCh(e.target.value)} aria-label="Channel">
          <option value="ALL">Semua channel</option>
          {channels.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="tabs-row"><Seg wrap value={f} onChange={setF} options={FILTERS} /></div>
      <div className="tabs-row"><SalFilter data={data} value={sal} onChange={setSal} /></div>
      <Panel title="DAFTAR TOKO" right={`${list.length} toko · ACT ${fmt.jt(act)} / TGT ${fmt.jt(tgt)} jt · klik toko untuk detail kategori`} flush>
        <StoreTable list={list} time={time} onStore={onStore} />
      </Panel>
    </>
  );
}
