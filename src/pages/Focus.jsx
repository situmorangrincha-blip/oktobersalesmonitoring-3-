import { useMemo } from 'react';
import { catAgg, fmt, groupBy, status, storeStats } from '../lib/calc.js';
import { Bar, Panel, Seg, useSorted } from '../components/ui.jsx';
import SalFilter from '../components/SalFilter.jsx';

const SUBS = [{ v: 'principal', label: 'Principal' }, { v: 'kategori', label: 'Kategori' }, { v: 'channel', label: 'Channel' }];

export default function Focus({ D, data, time, mode, sub, setSub, sal, setSal }) {
  const stores = useMemo(() => (sal === 'ALL' ? data.stores : data.stores.filter((s) => s.sales === sal)), [data, sal]);
  return (
    <>
      <div className="tabs-row">
        <Seg value={sub} onChange={setSub} options={SUBS} />
        <SalFilter data={data} value={sal} onChange={setSal} />
      </div>
      {sub === 'principal' && <PrincipalView D={D} time={time} mode={mode} sal={sal} />}
      {sub === 'kategori' && <CategoryView data={data} stores={stores} />}
      {sub === 'channel' && <ChannelView stores={stores} time={time} />}
    </>
  );
}

function PrincipalView({ D, time, mode, sal }) {
  const ps = D.principals.filter((p) => D.total.pr[p].tgt > 0 || D.total.pr[p].act > 0);
  const list = sal === 'ALL' ? D.sales : D.sales.filter((s) => s.name === sal);
  return (
    <div className="grid g2">
      {ps.map((p) => {
        const tot = D.total.pr[p];
        return (
          <Panel key={p} title={`${p} VS ${mode === 'bti' ? 'BTI' : 'MILESTONE'}`} right={`${fmt.pct(tot.acv)} · ${fmt.jt(tot.act)}/${fmt.jt(tot.tgt)} jt`} flush>
            <div className="scroll">
              <table className="t">
                <thead><tr><th>Salesman</th><th>TGT</th><th>ACT</th><th>ACV</th><th>GAP</th></tr></thead>
                <tbody>
                  {[...list].sort((a, b) => b.pr[p].acv - a.pr[p].acv).map((s) => {
                    const x = s.pr[p];
                    return (
                      <tr key={s.name}>
                        <td className="nm">{s.name}</td>
                        <td>{fmt.jt(x.tgt)}</td>
                        <td>{fmt.jt(x.act)}</td>
                        <td className="bc"><div className="barlbl"><Bar value={x.acv} mark={time.tg} tg={time.tg} /><span className={status(x.acv, time.tg)}>{x.tgt ? fmt.pct(x.acv) : '-'}</span></div></td>
                        <td className={x.gap < 0 ? 'neg' : ''}>{fmt.jt(x.gap)}</td>
                      </tr>
                    );
                  })}
                  {sal === 'ALL' && (
                    <tr className="tot"><td>TOTAL</td><td>{fmt.jt(tot.tgt)}</td><td>{fmt.jt(tot.act)}</td><td>{fmt.pct(tot.acv)}</td><td className={tot.gap < 0 ? 'neg' : ''}>{fmt.jt(tot.gap)}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function CategoryView({ data, stores }) {
  const agg = useMemo(() => catAgg(data, stores).filter((r) => r.cur || r.lm || r.l3m), [data, stores]);
  const total = agg.reduce((a, r) => a + r.cur, 0);
  const brands = useMemo(() => {
    const m = new Map();
    for (const r of agg) m.set(r.b, (m.get(r.b) || 0) + r.cur);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [agg]);
  const { rows, th } = useSorted(agg, 'cur', -1);
  const n = stores.length;
  if (!data.subs.length) return <Panel title="KATEGORI"><div className="empty">Sheet OLAP FOCUS CATEGORY belum terbaca di data ini.</div></Panel>;
  return (
    <div className="grid">
      <Panel title="SHARE BRAND OKTOBER" right={`${fmt.jt(total)} jt · ${n} toko`}>
        <div className="mini" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          {brands.map(([b, v]) => (
            <div className="it" key={b}>
              <div className="h"><span>{b}</span><span>{fmt.pct(total ? v / total : 0, 0)}</span></div>
              <Bar value={total ? v / total : 0} color="bg-mp" />
              <div className="sub">{fmt.jt(v)} jt</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="SUB BRAND (KATEGORI) PER PERIODE" right="jt · L3M = rata-rata/bulan" flush>
        <div className="scroll">
          <table className="t">
            <thead>
              <tr>
                {th('n', 'Kategori', 'l')}
                {th('p', 'Prin.', 'l')}
                {th('cur', 'OKT')}
                {th('lm', 'SEP')}
                {th('l3m', 'L3M')}
                {th((r) => (r.lm ? r.cur / r.lm : 0), 'vs SEP')}
                {th('buyers', 'Toko beli')}
                {th((r) => (total ? r.cur / total : 0), 'Share')}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i}>
                  <td className="nm">{r.n}</td>
                  <td className="l mut">{r.p}</td>
                  <td>{fmt.jt(r.cur, 2)}</td>
                  <td>{fmt.jt(r.lm, 2)}</td>
                  <td>{fmt.jt(r.l3m, 2)}</td>
                  <td className={r.lm && r.cur < r.lm ? 'neg' : ''}>{r.lm ? fmt.pct(r.cur / r.lm, 0) : '-'}</td>
                  <td>{r.buyers} <span className="mut">({fmt.pct(n ? r.buyers / n : 0, 0)})</span></td>
                  <td>{fmt.pct(total ? r.cur / total : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ChannelTable({ title, stores, keyOf, time }) {
  const rows = useMemo(() => {
    const g = groupBy(stores, keyOf);
    return [...g.entries()].map(([k, l]) => ({ k, ...storeStats(l) }));
  }, [stores]);
  const { rows: r, th } = useSorted(rows, 'act', -1);
  const tot = storeStats(stores);
  return (
    <Panel title={title} right={`${rows.length} channel`} flush>
      <div className="scroll">
        <table className="t">
          <thead>
            <tr>
              {th('k', 'Channel', 'l')}
              {th('n', 'Toko')}
              {th('ca', 'CA')}
              {th('caPct', 'CA%')}
              {th('caProd', 'Prod')}
              {th('act', 'ACT')}
              {th('tgt', 'TGT toko')}
              {th('acv', 'ACV')}
              {th('lm', 'SEP')}
              {th('l3m', 'L3M')}
            </tr>
          </thead>
          <tbody>
            {r.map((x) => (
              <tr key={x.k}>
                <td className="nm">{x.k}</td>
                <td>{x.n}</td>
                <td>{x.ca}</td>
                <td className="bc"><div className="barlbl"><Bar value={x.caPct} color="bg-mp" /><span>{fmt.pct(x.caPct, 0)}</span></div></td>
                <td>{x.caProd}</td>
                <td>{fmt.jt(x.act)}</td>
                <td>{fmt.jt(x.tgt)}</td>
                <td className={status(x.acv, time.tg)}>{x.tgt ? fmt.pct(x.acv, 0) : '-'}</td>
                <td>{fmt.jt(x.lm)}</td>
                <td>{fmt.jt(x.l3m)}</td>
              </tr>
            ))}
            <tr className="tot">
              <td>TOTAL</td><td>{tot.n}</td><td>{tot.ca}</td><td>{fmt.pct(tot.caPct, 0)}</td><td>{tot.caProd}</td>
              <td>{fmt.jt(tot.act)}</td><td>{fmt.jt(tot.tgt)}</td><td>{fmt.pct(tot.acv, 0)}</td><td>{fmt.jt(tot.lm)}</td><td>{fmt.jt(tot.l3m)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ChannelView({ stores, time }) {
  return (
    <div className="grid">
      <ChannelTable title="CHANNEL (CC1)" stores={stores} keyOf={(s) => s.cc1} time={time} />
      <ChannelTable title="SUB CHANNEL (CC2)" stores={stores} keyOf={(s) => s.cc2} time={time} />
    </div>
  );
}
