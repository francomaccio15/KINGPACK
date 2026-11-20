'use client';

// Selector de cheques de clientes EN CARTERA para endosarlos en un pago
// (egresos: sueldos, retiros, gastos). Mismo criterio que «Endosar en cartera»
// de Pago a Proveedores: el cheque pasa a endosado, no se vuelve a cargar.

import { useEffect, useMemo, useState } from 'react';

export interface ChequeCartera {
  id: string;
  origen_tipo: string;
  banco: string | null;
  numero_cheque: string | null;
  importe: string;
  fecha_vencimiento: string | null;
  origen_nombre: string | null;
}

/** Lo que espera el backend en `endosos`. */
export const endososPayload = (sel: ChequeCartera[]) =>
  sel.map(c => ({ cheque_origen: c.origen_tipo, cheque_id: c.id, importe: parseFloat(c.importe) }));

export const totalEndosos = (sel: ChequeCartera[]) =>
  sel.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmtVenc = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

interface Props {
  value: ChequeCartera[];
  onChange: (sel: ChequeCartera[]) => void;
  /** Importe a cubrir con cheques, para mostrar cuánto falta. */
  objetivo?: number;
}

export default function EndosoCartera({ value, onChange, objetivo }: Props) {
  const [cartera, setCartera] = useState<ChequeCartera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [q, setQ]             = useState('');

  useEffect(() => {
    let vivo = true;
    apiFetch('/api/cheques?tipo=recibido&estado=en_cartera&limit=500')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (!vivo) return;
        const lista: ChequeCartera[] = d.cheques ?? [];
        // Vencimiento más próximo arriba.
        lista.sort((a, b) => (a.fecha_vencimiento ?? '').localeCompare(b.fecha_vencimiento ?? ''));
        setCartera(lista);
      })
      .catch(() => { if (vivo) setError('No se pudieron traer los cheques en cartera'); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, []);

  const elegidos = useMemo(() => new Set(value.map(c => c.id)), [value]);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return cartera;
    return cartera.filter(c =>
      [c.banco, c.numero_cheque, c.origen_nombre, c.importe].some(v => (v ?? '').toLowerCase().includes(t))
    );
  }, [cartera, q]);

  const toggle = (c: ChequeCartera) =>
    onChange(elegidos.has(c.id) ? value.filter(v => v.id !== c.id) : [...value, c]);

  const total = totalEndosos(value);
  const falta = objetivo != null ? +(objetivo - total).toFixed(2) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">
          Cheques en cartera ({value.length} elegido{value.length === 1 ? '' : 's'})
        </p>
        <input
          type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar banco, número, cliente o importe"
          className="h-8 w-64 max-w-full px-2 text-xs rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red"
        />
      </div>

      {loading ? (
        <p className="text-xs text-kp-gray">Cargando cheques…</p>
      ) : error ? (
        <p className="text-xs text-kp-red">{error}</p>
      ) : cartera.length === 0 ? (
        <p className="text-xs text-kp-gray">No hay cheques de clientes en cartera para endosar.</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {filtrados.length === 0 && <p className="text-xs text-kp-gray">Ningún cheque coincide con la búsqueda.</p>}
          {filtrados.map(c => {
            const sel = elegidos.has(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c)}
                className={`w-full flex items-center gap-3 text-left rounded-lg border px-3 py-2 transition-colors ${
                  sel ? 'border-kp-red bg-kp-red/10' : 'border-kp-border bg-kp-surface2/40 hover:border-kp-gray'}`}>
                <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                  sel ? 'bg-kp-red border-kp-red text-white' : 'border-kp-gray text-transparent'}`}>✓</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-kp-white truncate">
                    {c.banco || 's/banco'} #{c.numero_cheque || 's/nº'}
                    {c.origen_nombre ? ` · ${c.origen_nombre}` : ''}
                  </span>
                  <span className="block text-[11px] text-kp-gray">Vence {fmtVenc(c.fecha_vencimiento)}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-kp-white">
                  {ars.format(parseFloat(c.importe) || 0)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {value.length > 0 && (
        <div className="flex justify-end gap-4 text-sm">
          <span><span className="text-kp-gray mr-2">Total endosado:</span>
            <span className="tabular-nums font-bold text-kp-white">{ars.format(total)}</span></span>
          {falta != null && Math.abs(falta) > 0.01 && (
            <span className={falta > 0 ? 'text-amber-400' : 'text-kp-red'}>
              {falta > 0 ? `Faltan ${ars.format(falta)}` : `Se pasa por ${ars.format(-falta)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
