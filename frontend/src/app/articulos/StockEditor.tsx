'use client';

import { useCallback, useEffect, useState } from 'react';
import NumericInput from '@/components/NumericInput';

type Sucursal = { id: string; nombre: string };
type Art = { id: string; codigo: string; nombre: string; stock_total: string };

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, {
    ...o,
    headers: {
      'Content-Type': 'application/json',
      ...(o.headers as Record<string, string> || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
};

// ─── Fila editable ─────────────────────────────────────────────────────────────
function FilaStock({
  art, sucursalId, onSaved,
}: {
  art: Art; sucursalId: string; onSaved: (id: string, cantidad: number) => void;
}) {
  const actual = parseFloat(art.stock_total) || 0;
  const [val, setVal]       = useState(String(actual));
  const [saving, setSaving] = useState(false);
  const [estado, setEstado] = useState<'idle' | 'ok' | 'err'>('idle');
  const [msg, setMsg]       = useState('');

  const nuevo  = parseFloat(val);
  const cambio = Number.isFinite(nuevo) && nuevo >= 0 && Math.abs(nuevo - actual) > 0.0001;

  const guardar = async () => {
    if (!cambio) return;
    setSaving(true); setEstado('idle'); setMsg('');
    try {
      const r = await apiFetch(`/api/articulos/${art.id}/stock`, {
        method: 'PUT',
        body: JSON.stringify({ sucursal_id: sucursalId, cantidad: nuevo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al guardar');
      setEstado('ok');
      onSaved(art.id, d.cantidad);
    } catch (e: any) {
      setEstado('err'); setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-kp-border/40 hover:bg-kp-surface2/30 transition-colors">
      <td className="px-4 py-2 font-mono text-xs text-kp-gray whitespace-nowrap">{art.codigo}</td>
      <td className="px-4 py-2 text-kp-white">{art.nombre}</td>
      <td className="px-4 py-2 text-center tabular-nums text-kp-gray whitespace-nowrap">{actual}</td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-2">
          <NumericInput
            value={val}
            onChange={e => { setVal(e.target.value); setEstado('idle'); }}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') guardar(); }}
            placeholder="0"
            className="w-24 bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5 text-sm text-right text-kp-white
              placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
          />
          <button
            onClick={guardar}
            disabled={!cambio || saving}
            title={cambio ? 'Guardar nueva cantidad' : 'Sin cambios'}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40
              bg-kp-red text-white hover:bg-kp-red-dark disabled:hover:bg-kp-red"
          >
            {saving ? '…' : estado === 'ok' && !cambio ? '✓' : 'Guardar'}
          </button>
        </div>
        {estado === 'err' && <p className="text-[11px] text-kp-red text-right mt-1">{msg}</p>}
      </td>
    </tr>
  );
}

// ─── Editor principal ────────────────────────────────────────────────────────
export default function StockEditor({
  sucursales, sucursalActivaId,
}: {
  sucursales: Sucursal[]; sucursalActivaId: string;
}) {
  const [sucursalId, setSucursalId] = useState(sucursalActivaId || sucursales.find(s => /laprida/i.test(s.nombre))?.id || sucursales[0]?.id || '');
  const [q, setQ]             = useState('');
  const [arts, setArts]       = useState<Art[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const cargar = useCallback(async () => {
    if (!sucursalId) { setArts([]); return; }
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({ sucursal_id: sucursalId, activo: 'true', limit: '100' });
      if (q.trim()) qs.set('q', q.trim());
      const r = await apiFetch(`/api/articulos?${qs}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al cargar artículos');
      setArts(d.articulos || []);
    } catch (e: any) {
      setError(e.message); setArts([]);
    } finally {
      setLoading(false);
    }
  }, [sucursalId, q]);

  // Debounce de búsqueda / recarga al cambiar sucursal
  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  const onSaved = (id: string, cantidad: number) =>
    setArts(prev => prev.map(a => (a.id === id ? { ...a, stock_total: String(cantidad) } : a)));

  const selectCls = 'bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors';

  return (
    <div className="space-y-4">

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Sucursal</label>
          <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className={selectCls}>
            {sucursales.length === 0 && <option value="">— sin sucursales —</option>}
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Buscar artículo</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Código o nombre…"
            className={`${selectCls} w-full`}
          />
        </div>
      </div>

      <p className="text-xs text-kp-gray/70">
        Ingresá la cantidad real de stock (valor absoluto). El sistema calcula la diferencia y la registra como ajuste.
      </p>

      {error && (
        <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Código</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Nombre</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Stock actual</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Nueva cantidad</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-kp-gray">Cargando…</td></tr>
            ) : arts.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-kp-gray">
                {sucursalId ? 'No hay artículos para mostrar.' : 'Elegí una sucursal.'}
              </td></tr>
            ) : (
              arts.map(a => (
                <FilaStock key={`${sucursalId}-${a.id}`} art={a} sucursalId={sucursalId} onSaved={onSaved} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
