import { useRef, useState } from 'react';
import { fmt, mergeKeepHistory } from '../lib/calc.js';
import { saveData } from '../lib/store.js';
import { sfx } from '../lib/audio.js';
import { Panel } from './ui.jsx';

export default function UploadModal({ existing, storeMode, timeOv, setTimeOv, auto, onDone, onClose }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [parsed, setParsed] = useState(null);
  const [keep, setKeep] = useState(true);
  const [ov, setOv] = useState({ hk: timeOv?.hk ?? '', total: timeOv?.total ?? '' });

  async function pick(file) {
    if (!file) return;
    setErr(''); setParsed(null); setBusy('Membaca file Excel...');
    try {
      await new Promise((r) => setTimeout(r, 60));
      const [{ parseWorkbook }, XLSX] = await Promise.all([import('../lib/parse.js'), import('xlsx')]);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: false, cellStyles: false });
      const d = parseWorkbook(wb, { fileName: file.name });
      setParsed(d);
      sfx.pick();
    } catch (e) {
      setErr(e.message || String(e));
      sfx.err();
    }
    setBusy('');
  }

  async function save() {
    setBusy('Menyimpan...'); setErr('');
    try {
      const d0 = { ...parsed, meta: { ...parsed.meta, uploadedAt: new Date().toISOString() } };
      const d = existing && keep ? mergeKeepHistory(existing, d0) : d0;
      await saveData(storeMode, d);
      const hk = ov.hk === '' ? null : Number(ov.hk);
      const total = ov.total === '' ? null : Number(ov.total);
      setTimeOv(hk == null && total == null ? null : { hk: hk ?? undefined, total: total ?? undefined });
      sfx.ok();
      onDone(d);
    } catch (e) {
      setErr(e.message || String(e));
      sfx.err();
      setBusy('');
    }
  }

  const sumAct = parsed ? Object.values(parsed.pAct).reduce((a, o) => a + (o.total || 0), 0) : 0;
  const ca = parsed ? parsed.stores.filter((s) => s.act >= 1).length : 0;

  return (
    <div className="veil" onClick={onClose} data-sfx="back">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <Panel title="UPLOAD DATA EXCEL" right={<button className="btn sm" data-sfx="back" onClick={onClose}>Tutup</button>}>
          <div
            className={'drop' + (over ? ' over' : '')}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
          >
            <b>{busy || (parsed ? 'Ganti file' : 'Tarik file .xlsx ke sini, atau klik untuk pilih')}</b>
            <div className="mut" style={{ marginTop: 4 }}>Bulan berjalan diganti dari file ini. Format sheet sama seperti file monitoring harian.</div>
            <input ref={input} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          {err && <div className="warn err">{err}</div>}

          {parsed && (
            <>
              <div className="mini" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginTop: 10 }}>
                <div className="it"><div className="h">Periode</div><b>{parsed.meta.period?.label || '-'}</b></div>
                <div className="it"><div className="h">Salesman</div><b>{parsed.salesmen.length}</b></div>
                <div className="it"><div className="h">Toko (JKS)</div><b>{fmt.int(parsed.stores.length)}</b></div>
                <div className="it"><div className="h">ACT total</div><b>{fmt.jt(sumAct)} jt</b></div>
                <div className="it"><div className="h">Toko CA</div><b>{ca}</b></div>
                <div className="it"><div className="h">Sub brand</div><b>{parsed.subs.length}</b></div>
              </div>
              {parsed.warnings.map((w, i) => <div className="warn" key={i}>{w}</div>)}
              {existing && (
                <label className="row" style={{ marginTop: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                  <span>Pertahankan data Sep &amp; L3M yang sudah tersimpan (hanya bulan ini yang diganti)</span>
                </label>
              )}
            </>
          )}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer' }}>Atur hari kerja manual (libur nasional, dll)</summary>
            <div className="row" style={{ marginTop: 8 }}>
              <label>Berjalan <input className="input" style={{ minWidth: 0, width: 80 }} type="number" min="0" placeholder={String(auto.auto)} value={ov.hk} onChange={(e) => setOv({ ...ov, hk: e.target.value })} /></label>
              <label>Total <input className="input" style={{ minWidth: 0, width: 80 }} type="number" min="1" placeholder={String(auto.total)} value={ov.total} onChange={(e) => setOv({ ...ov, total: e.target.value })} /></label>
              <span className="mut">Kosongkan = otomatis (Senin–Sabtu, sampai kemarin).</span>
            </div>
          </details>

          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn" data-sfx="back" onClick={onClose}>Batal</button>
            <button className="btn hp" data-sfx="none" disabled={!parsed || !!busy} onClick={save}>{busy && parsed ? busy : 'Simpan & tampilkan'}</button>
          </div>
          <div className="mut" style={{ fontSize: 12, marginTop: 8 }}>
            Penyimpanan: {storeMode === 'cloud' ? 'cloud (Vercel Blob), bisa dibuka dari HP/laptop mana pun dengan password' : 'lokal di browser ini (mode dev, belum ada backend)'}.
          </div>
        </Panel>
      </div>
    </div>
  );
}
