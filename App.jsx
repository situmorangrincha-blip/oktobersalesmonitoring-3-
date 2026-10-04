import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio, sfx } from './lib/audio.js';
import { derive, timeInfo } from './lib/calc.js';
import { getPass, loadData, setPass } from './lib/store.js';
import Stage from './components/Stage.jsx';
import UploadModal from './components/UploadModal.jsx';
import StoreModal from './components/StoreModal.jsx';
import { Panel } from './components/ui.jsx';
import Performance from './pages/Performance.jsx';
import Focus from './pages/Focus.jsx';
import Stores from './pages/Stores.jsx';
import Pareto from './pages/Pareto.jsx';
import Salesman from './pages/Salesman.jsx';

const PAGES = [
  { id: 'perf', label: 'PERFORMA' },
  { id: 'focus', label: 'FOKUS' },
  { id: 'stores', label: 'TOKO' },
  { id: 'pareto', label: 'PARETO & CA' },
  { id: 'sales', label: 'SALESMAN' },
];

const Logo = () => (
  <svg viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
    <rect width="8" height="8" fill="#20214a" />
    <rect x="1" y="1" width="6" height="1" fill="#ffc933" />
    <rect x="1" y="3" width="2" height="4" fill="#2fbf71" />
    <rect x="4" y="4" width="1" height="3" fill="#35a8e0" />
    <rect x="6" y="2" width="1" height="5" fill="#ec4a5a" />
  </svg>
);

const fmtUp = (iso) => {
  try {
    return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

export default function App() {
  const [boot, setBoot] = useState('loading'); // loading | login | ready | error
  const [storeMode, setStoreMode] = useState('cloud');
  const [data, setData] = useState(null);
  const [bootErr, setBootErr] = useState('');
  const [page, setPage] = useState('perf');
  const [subs, setSubs] = useState({ focus: 'principal', pareto: 'pj' });
  const [mode, setMode] = useState('milestone');
  const [sal, setSal] = useState('ALL');
  const [up, setUp] = useState(false);
  const [store, setStore] = useState(null);
  const [aud, setAud] = useState(audio.get());
  const [snapping, setSnapping] = useState(false);
  const [toast, setToast] = useState('');
  const [timeOv, setTimeOvState] = useState(() => { try { return JSON.parse(localStorage.getItem('tq_time') || 'null'); } catch { return null; } });
  const prev = useRef({ page: 'perf' });

  const setTimeOv = (v) => { setTimeOvState(v); if (v) localStorage.setItem('tq_time', JSON.stringify(v)); else localStorage.removeItem('tq_time'); };
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const boot0 = useCallback(async () => {
    setBoot('loading');
    try {
      const r = await loadData();
      setStoreMode(r.mode);
      setData(r.data);
      setBoot('ready');
    } catch (e) {
      if (e?.code === 401) setBoot('login');
      else { setBootErr(e?.message || 'Gagal memuat data'); setBoot('error'); }
    }
  }, []);
  useEffect(() => { boot0(); }, [boot0]);

  const time = useMemo(() => (data ? timeInfo(data.meta.period, timeOv) : null), [data, timeOv]);
  const D = useMemo(() => (data ? derive(data, mode === 'bti' && !data.meta.hasBti ? 'milestone' : mode, time) : null), [data, mode, time]);
  const autoTime = useMemo(() => (data ? timeInfo(data.meta.period, null) : { auto: 0, total: 27 }), [data]);

  useEffect(() => { prev.current = { page }; });
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);

  // sfx otomatis untuk semua klik; override dengan data-sfx="nav|pick|back|none"
  const onClick = (e) => {
    const el = e.target.closest?.('[data-sfx],button,.clickable,.drop,label');
    if (!el) return;
    const t = el.getAttribute('data-sfx') || 'click';
    if (t !== 'none' && sfx[t]) sfx[t]();
  };

  const toggleSfx = () => { audio.setSfx(!aud.sfx); setAud(audio.get()); };
  const toggleBgm = () => { audio.setBgm(!aud.bgm); setAud(audio.get()); };

  async function snap() {
    if (page !== 'perf') return;
    setSnapping(true);
    sfx.snap();
    try {
      await new Promise((r) => setTimeout(r, 450));
      const { toPng } = await import('html-to-image');
      const el = document.getElementById('snap');
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const name = `performance-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Performance' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = name; a.click();
      }
      sfx.ok();
      say('Screenshot tersimpan');
    } catch (e) {
      sfx.err();
      say('Gagal bikin gambar: ' + (e?.message || e));
    }
    setSnapping(false);
  }

  const idx = PAGES.findIndex((p) => p.id === page);
  const pidx = PAGES.findIndex((p) => p.id === prev.current.page);
  const pageChanged = pidx !== idx;
  const sub = subs[page];
  const key = `${page}|${sub || ''}|${sal}|${mode}`;

  let body = null;
  if (D) {
    const common = { D, data, time };
    body = {
      perf: <Performance {...common} mode={mode} setMode={setMode} snapping={snapping} />,
      focus: <Focus {...common} mode={mode} sub={subs.focus} setSub={(v) => setSubs({ ...subs, focus: v })} sal={sal} setSal={setSal} />,
      stores: <Stores data={data} time={time} sal={sal} setSal={setSal} onStore={setStore} />,
      pareto: <Pareto {...common} sub={subs.pareto} setSub={(v) => setSubs({ ...subs, pareto: v })} sal={sal} setSal={setSal} onStore={setStore} />,
      sales: <Salesman {...common} sal={sal} setSal={setSal} onStore={setStore} />,
    }[page];
  }

  if (boot === 'loading') return <div className="app" onPointerDownCapture={audio.unlock}><div className="login"><Panel title="LOADING..."><div className="empty"><h2>MEMUAT DATA</h2></div></Panel></div></div>;
  if (boot === 'error') return <div className="app"><div className="login"><Panel title="ERROR"><div className="empty"><h2>GAGAL MEMUAT</h2><p>{bootErr}</p><button className="btn coin" onClick={boot0}>Coba lagi</button></div></Panel></div></div>;
  if (boot === 'login') return <Login onOk={boot0} />;

  return (
    <div className="app" onClickCapture={onClick} onPointerDownCapture={audio.unlock}>
      <header className="top">
        <div className="logo">
          <Logo />
          <div>
            <b>TARGET QUEST</b>
            <small>{data ? `Sales monitoring${data.meta.region ? ' · ' + data.meta.region : ''}` : 'Sales monitoring'}</small>
          </div>
        </div>
        {data && <span className="chip dim" title="Waktu upload terakhir">update {fmtUp(data.meta.uploadedAt)}</span>}
        <button className="btn sm" data-sfx="none" onClick={toggleSfx}><span className={'dot' + (aud.sfx ? ' on' : '')} />SFX {aud.sfx ? 'ON' : 'OFF'}</button>
        <button className="btn sm" data-sfx="none" onClick={toggleBgm}><span className={'dot' + (aud.bgm ? ' on' : '')} />BGM {aud.bgm ? 'ON' : 'OFF'}</button>
        {data && page === 'perf' && <button className="btn sm" data-sfx="none" onClick={snap}>SNAP PNG</button>}
        <button className="btn coin sm" onClick={() => setUp(true)}>UPLOAD</button>
      </header>

      <nav className="nav" aria-label="Halaman">
        {PAGES.map((p) => (
          <button key={p.id} data-sfx="nav" className={'btn' + (p.id === page ? ' on' : '')} aria-current={p.id === page ? 'page' : undefined} onClick={() => setPage(p.id)}>
            {p.label}
          </button>
        ))}
      </nav>

      {!data ? (
        <Panel title="INSERT COIN">
          <div className="empty">
            <h2>BELUM ADA DATA</h2>
            <p className="mut">Upload file Excel monitoring untuk mulai.</p>
            <button className="btn coin" onClick={() => setUp(true)}>UPLOAD EXCEL</button>
          </div>
        </Panel>
      ) : (
        <Stage k={key} kind={pageChanged ? 'cube' : 'flip'} dir={idx - pidx}>
          {body}
        </Stage>
      )}

      <div className="foot">{data ? `${data.meta.fileName || 'data'} · hari kerja ${time.hk}/${time.total}${time.overridden ? ' (manual)' : ''} · angka dalam jutaan rupiah` : ''}</div>

      {up && (
        <UploadModal
          existing={data} storeMode={storeMode} timeOv={timeOv} setTimeOv={setTimeOv} auto={autoTime}
          onClose={() => setUp(false)}
          onDone={(d) => { setData(d); setUp(false); say('Data berhasil disimpan'); }}
        />
      )}
      {store && data && <StoreModal s={store} data={data} time={time} onClose={() => setStore(null)} />}
      {snapping && <div className="veil"><div className="modal"><Panel title="SNAP"><div className="empty"><h2>MEREKAM LAYAR...</h2></div></Panel></div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Login({ onOk }) {
  const [p, setP] = useState(getPass());
  const [err, setErr] = useState(getPass() ? 'Password salah' : '');
  const go = async (e) => {
    e.preventDefault();
    audio.unlock();
    setPass(p);
    await onOk();
  };
  useEffect(() => { if (err) sfx.err(); }, []); // eslint-disable-line
  return (
    <div className="app" onPointerDownCapture={audio.unlock}>
      <form className="login" onSubmit={go}>
        <Panel title="PRESS START">
          <div className="empty" style={{ padding: '20px 10px' }}>
            <h2>TARGET QUEST</h2>
            <input className="input" type="password" autoFocus placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} />
            {err && <div className="warn err">{err}</div>}
            <div style={{ marginTop: 14 }}><button className="btn coin" type="submit">MASUK</button></div>
          </div>
        </Panel>
      </form>
    </div>
  );
}
