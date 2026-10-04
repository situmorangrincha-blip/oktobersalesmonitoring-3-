import { useMemo, useState } from 'react';
import { status } from '../lib/calc.js';

export function Panel({ title, right, children, flush, className = '' }) {
  return (
    <section className={'panel ' + className}>
      {title && (
        <div className="ph">
          <span>{title}</span>
          {right != null && <span className="r">{right}</span>}
        </div>
      )}
      <div className={'pb' + (flush ? ' flush' : '')}>{children}</div>
    </section>
  );
}

export function Seg({ value, options, onChange, wrap, disabled }) {
  return (
    <div className={'seg' + (wrap ? ' wrap' : '')} role="tablist" aria-disabled={disabled ? 'true' : 'false'}>
      {options.map((o) => (
        <button key={o.v} data-sfx="pick" role="tab" aria-selected={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ratio 0..n, mark = posisi timegone (0..1)
export function Bar({ value, mark, tg, big, color }) {
  const st = tg != null ? status(value, tg) : null;
  const cls = color || (st ? 'bg-' + st : 'bg-mp');
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={'bar' + (big ? ' big' : '')}>
      <i className={cls} style={{ width: w + '%' }} />
      {mark != null && <b style={{ left: Math.min(1, mark) * 100 + '%' }} title="timegone" />}
    </div>
  );
}

export function useSorted(rows, defKey, defDir = -1) {
  const [key, setKey] = useState(defKey);
  const [dir, setDir] = useState(defDir);
  const sorted = useMemo(() => {
    const f = typeof key === 'function' ? key : (r) => r[key];
    return [...rows].sort((a, b) => {
      const x = f(a), y = f(b);
      if (typeof x === 'string' || typeof y === 'string') return String(x ?? '').localeCompare(String(y ?? '')) * dir;
      return ((x ?? 0) - (y ?? 0)) * dir;
    });
  }, [rows, key, dir]);
  const th = (k, label, cls = '') => (
    <th
      className={'sortable ' + cls + (key === k ? ' sorted' : '')}
      data-sfx="click"
      onClick={() => { if (key === k) setDir(-dir); else { setKey(k); setDir(-1); } }}
    >
      {label}{key === k ? (dir < 0 ? ' ▼' : ' ▲') : ''}
    </th>
  );
  return { rows: sorted, th };
}

export const Kpi = ({ label, value, unit, sub, cls = '', hero }) => (
  <div className={'kpi' + (hero ? ' hero' : '')}>
    <div className="l">{label}</div>
    <div className={'v ' + cls}>{value}{unit && <small>{unit}</small>}</div>
    <div className="s">{sub}</div>
  </div>
);

export const initials = (n) => String(n).split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
