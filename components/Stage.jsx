import { useLayoutEffect, useRef, useState } from 'react';

const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Transisi 3D: ganti halaman = kubus berputar, ganti pilihan/filter = kartu membalik.
export default function Stage({ k, kind = 'flip', dir = 1, children }) {
  const wrap = useRef(null);
  const last = useRef({ k, node: children });
  const first = useRef(true);
  const [leave, setLeave] = useState(null);
  const timer = useRef(null);

  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (last.current.k === k || reduce()) return;
    const w = wrap.current?.offsetWidth || 900;
    setLeave({ node: last.current.node, kind, dir, w, id: Math.random() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeave(null), kind === 'cube' ? 620 : 520);
  }, [k]);

  useLayoutEffect(() => { last.current = { k, node: children }; });

  const cube = leave?.kind === 'cube';
  const side = leave?.dir >= 0 ? 'n' : 'p';
  const origin = cube ? { transformOrigin: `50% 30% ${-leave.w / 2}px` } : undefined;
  const curCls = leave ? (cube ? `cube-in-${side}` : 'flip-in') : '';
  const outCls = leave ? (cube ? `cube-out-${side}` : 'flip-out') : '';

  return (
    <div className={'stage' + (leave ? ' run' : '')} ref={wrap}>
      <div className={curCls} style={cube ? origin : undefined} key={'cur'}>
        {children}
      </div>
      {leave && (
        <div className={'leave ' + outCls} style={origin} aria-hidden="true" key={leave.id}>
          {leave.node}
        </div>
      )}
    </div>
  );
}
