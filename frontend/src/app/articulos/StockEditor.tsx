'use client';

import { useCallback, useEffect, useState } from 'react';
import NumericInput from '@/components/NumericInput';

type Sucursal = { id: string; nombre: string };
type Art = {
  id: string; codigo: string; nombre: string;
  stock_total: string; stock_adelante: string; stock_deposito: string;
};

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
  art: Art; sucursalId: string;
  onSaved: (id: string, cantidad: number, adelante: number, deposito: number) => void;
}) {
  const adeActual = parseFloat(art.stock_adelante) || 0;
  const depActual = parseFloat(art.stock_deposito) || 0;

  const [ade, setAde]       = useState(String(adeActual));
  const [dep, setDep]       = useState(String(depActual));
  const [saving, setSaving] = useState(false);
  const [estado, setEstado] = useState<'idle' | 'ok' | 'err'>('idle');
  const [msg, setMsg]       = useState('');

  const nAde = parseFloat(ade);
  const nDep = parseFloat(dep);
  const adeOk = Number.isFinite(nAde) && nAde >= 0;
  const depOk = Number.isFinite(nDep) && nDep >= 0;
  const total = (adeOk ? nAde : 0) + (depOk ? nDep : 0);

  const cambio = adeOk && depOk &&
    (Math.abs(nAde - adeActual) > 0.0001 || Math.abs(nDep - depActual) > 0.0001);

  const guardar = async () => {
    if (!cambio) return;
    setSaving(true); setEstado('idle'); setMsg('');
    try {
      const r = await apiFetch(`/api/articulos/${art.id}/stock`, {
        method: 'PUT',
        body: JSON.stringify({
          sucursal_id: sucursalId,
          cantidad_adelante: nAde,
          cantidad_deposito: nDep,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al guardar');
      setEstado('ok');
      onSaved(art.id, d.cantidad, d.cantidad_adelante, d.cantidad_deposito);
    } catch (e: any) {
      setEstado('err'); setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-24 bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5 text-sm text-right text-kp-white ' +
    'placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors';

  return (
    <tr className="border-b border-kp-border/40 hover:bg-kp-surface2/30 transition-colors">
      <td className="px-4 py-2 font-mono text-xs text-kp-gray whitespace-nowrap">{art.codigo}</td>
      <td className="px-4 py-2 text-kp-white">{art.nombre}</td>
      <td className="px-4 py-2">
        <div className="flex justify-end">
          <NumericInput
            value={ade}
            onChange={e => { setAde(e.target.value); setEstado('idle'); }}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') guardar(); }}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex justify-end">
          <NumericInput
            value={dep}
            onChange={e => { setDep(e.target.value); setEstado('idle'); }}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') guardar(); }}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </td>
      <td className="px-4 py-2 text-center tabular-nums font-semibold text-kp-white whitespace-nowrap">
        {Number.isFinite(total) ? total : '—'}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end">
          <button
            onClick={guardar}
            disabled={!cambio || saving}
            title={cambio ? 'Guardar cantidades' : 'Sin cambios'}
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

  // Exportar planilla de conteo (PDF en blanco para recuento físico)
  const [showConteo, setShowConteo]       = useState(false);
  const [conteoSuc, setConteoSuc]         = useState('');
  const [conteoUbic, setConteoUbic]       = useState<'deposito' | 'adelante'>('deposito');
  const [conteoLoading, setConteoLoading] = useState(false);
  const [conteoError, setConteoError]     = useState('');

  const abrirConteo = () => {
    setConteoSuc(sucursalId);
    setConteoUbic('deposito');
    setConteoError('');
    setShowConteo(true);
  };

  const generarConteo = async () => {
    if (!conteoSuc) { setConteoError('Elegí una sucursal.'); return; }
    setConteoLoading(true); setConteoError('');
    try {
      const r = await apiFetch(`/api/articulos/pdf-conteo?sucursal_id=${conteoSuc}&ubicacion=${conteoUbic}`);
      if (!r.ok) {
        let msg = 'Error al generar la planilla';
        try { const d = await r.json(); msg = d.error || msg; } catch { /* no-json */ }
        throw new Error(msg);
      }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setShowConteo(false);
    } catch (e: any) {
      setConteoError(e.message);
    } finally {
      setConteoLoading(false);
    }
  };

  const cargar = useCallback(async () => {
    if (!sucursalId) { setArts([]); return; }
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({ sucursal_id: sucursalId, activo: 'true', limit: '1000' });
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

  const onSaved = (id: string, cantidad: number, adelante: number, deposito: number) =>
    setArts(prev => prev.map(a => (a.id === id
      ? { ...a, stock_total: String(cantidad), stock_adelante: String(adelante), stock_deposito: String(deposito) }
      : a)));

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
        <button
          onClick={abrirConteo}
          className="flex items-center gap-2 bg-kp-red hover:bg-kp-red-dark text-kp-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 10v6m0 0-3-3m3 3 3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3M16 6l-4-4-4 4" />
          </svg>
          Exportar planilla de conteo
        </button>
      </div>

      <p className="text-xs text-kp-gray/70">
        Ingresá la cantidad real contada en cada ubicación (Adelante y Depósito). El <span className="text-kp-white font-semibold">Stock actual</span> es la suma de ambas; el sistema calcula la diferencia y la registra como ajuste.
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
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Stock adelante</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Stock depósito</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Stock actual</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-kp-gray">Cargando…</td></tr>
            ) : arts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-kp-gray">
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

      {/* ── Modal: exportar planilla de conteo ── */}
      {showConteo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget && !conteoLoading) setShowConteo(false); }}
        >
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-kp-white">Planilla de conteo</h3>
              </div>
              <button onClick={() => !conteoLoading && setShowConteo(false)}
                className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-kp-gray/80">
                Se genera un PDF con todos los artículos y una columna en blanco para anotar la cantidad contada.
              </p>

              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Sucursal</label>
                <select value={conteoSuc} onChange={e => setConteoSuc(e.target.value)} className={`${selectCls} w-full`}>
                  {sucursales.length === 0 && <option value="">— sin sucursales —</option>}
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Ubicación</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['deposito', 'Depósito'], ['adelante', 'Frente del local']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setConteoUbic(val)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                        ${conteoUbic === val
                          ? 'bg-kp-red/15 border-kp-red text-kp-white'
                          : 'bg-kp-surface2 border-kp-border text-kp-gray-lt hover:border-kp-gray'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {conteoError && (
                <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{conteoError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowConteo(false)} disabled={conteoLoading}
                  className="flex-1 text-sm py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={generarConteo} disabled={conteoLoading || !conteoSuc}
                  className="flex-1 text-sm py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark text-kp-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {conteoLoading ? 'Generando…' : 'Generar PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
