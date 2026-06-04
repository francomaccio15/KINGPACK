'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

type Facturacion = {
  cae: string;
  factura_numero: number;
  punto_venta: number;
  tipo_comprobante: string;
} | null;

interface MedioPago { id: string; nombre: string; }
interface PagoConfirm { medio_pago_id: string; monto: string; }

export default function AccionesVenta({
  ventaId, estado, total, facturacion, observaciones,
}: {
  ventaId: string;
  estado: string;
  total: string;
  facturacion: Facturacion;
  observaciones: string | null;
}) {
  const router = useRouter();
  const [loadingFactura, setLoadingFactura] = useState(false);
  const [resultFactura,  setResultFactura]  = useState<{ CAE?: string; _mock?: boolean; error?: string } | null>(null);
  const [anularOpen,    setAnularOpen]    = useState(false);
  const [anularMotivo,  setAnularMotivo]  = useState('');
  const [anularLoading, setAnularLoading] = useState(false);
  const [anularError,   setAnularError]   = useState('');
  const [editObsOpen,   setEditObsOpen]   = useState(false);
  const [editObsText,   setEditObsText]   = useState('');
  const [editObsLoading,setEditObsLoading]= useState(false);
  const [editObsError,  setEditObsError]  = useState('');

  // Confirmar preventa
  const [confirmarOpen,    setConfirmarOpen]    = useState(false);
  const [confirmarLoading, setConfirmarLoading] = useState(false);
  const [confirmarError,   setConfirmarError]   = useState('');
  const [mediosPago,       setMediosPago]       = useState<MedioPago[]>([]);
  const [pagos,            setPagos]            = useState<PagoConfirm[]>([]);

  useEffect(() => {
    if (!confirmarOpen || mediosPago.length > 0) return;
    apiFetch('/api/ventas/medios-pago')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const lista: MedioPago[] = d.medios_pago ?? [];
        setMediosPago(lista);
        if (pagos.length === 0 && lista.length > 0) {
          setPagos([{ medio_pago_id: lista[0].id, monto: String(parseFloat(total) || '') }]);
        }
      })
      .catch(() => {});
  }, [confirmarOpen]);

  const agregarPagoConfirmar = () => {
    const primero = mediosPago[0]?.id ?? '';
    setPagos(prev => [...prev, { medio_pago_id: primero, monto: '' }]);
  };

  const totalPagos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
  const totalVenta = parseFloat(total) || 0;

  const handleConfirmar = async () => {
    const invalido = pagos.some(p => !p.medio_pago_id || !parseFloat(p.monto));
    if (invalido || pagos.length === 0) { setConfirmarError('Agregá al menos un método de pago con monto.'); return; }
    if (Math.abs(totalPagos - totalVenta) > 0.01) { setConfirmarError(`El total de pagos (${ars.format(totalPagos)}) no coincide con el total de la venta (${ars.format(totalVenta)}).`); return; }
    setConfirmarLoading(true);
    setConfirmarError('');
    try {
      const res = await apiFetch(`/api/ventas/${ventaId}/confirmar-preventa`, {
        method: 'PATCH',
        body: JSON.stringify({ pagos: pagos.map(p => ({ medio_pago_id: p.medio_pago_id, monto: parseFloat(p.monto) })) }),
      });
      const data = await res.json();
      if (!res.ok) { setConfirmarError(data.error ?? 'Error al confirmar'); return; }
      setConfirmarOpen(false);
      router.refresh();
    } catch { setConfirmarError('Error de conexión'); }
    finally { setConfirmarLoading(false); }
  };

  const generarFacturaTest = async () => {
    setLoadingFactura(true);
    setResultFactura(null);
    try {
      const res  = await apiFetch(`/api/ventas/${ventaId}/factura-test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al facturar');
      setResultFactura(data);
      router.refresh();
    } catch (err: any) {
      setResultFactura({ error: err.message });
    } finally {
      setLoadingFactura(false);
    }
  };

  const handleAnular = async () => {
    if (!anularMotivo.trim() || anularMotivo.trim().length < 5) {
      setAnularError('El motivo debe tener al menos 5 caracteres');
      return;
    }
    setAnularLoading(true);
    setAnularError('');
    try {
      const res = await apiFetch(`/api/ventas/${ventaId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'anulada', motivo: anularMotivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAnularError(data.error ?? 'Error al anular'); return; }
      setAnularOpen(false);
      router.refresh();
    } catch { setAnularError('Error de conexión'); }
    finally { setAnularLoading(false); }
  };

  const handleEditObs = async () => {
    setEditObsLoading(true);
    setEditObsError('');
    try {
      const res = await apiFetch(`/api/ventas/${ventaId}/observaciones`, {
        method: 'PATCH',
        body: JSON.stringify({ observaciones: editObsText }),
      });
      const data = await res.json();
      if (!res.ok) { setEditObsError(data.error ?? 'Error al guardar'); return; }
      setEditObsOpen(false);
      router.refresh();
    } catch { setEditObsError('Error de conexión'); }
    finally { setEditObsLoading(false); }
  };

  const yaFacturada = !!(facturacion?.cae);

  return (
    <>
    <div className="flex flex-col items-end gap-3 print:hidden">
      <div className="flex flex-wrap gap-2">

        {/* Confirmar preventa */}
        {estado === 'preventa' && (
          <button
            onClick={() => { setPagos([]); setConfirmarError(''); setConfirmarOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              bg-green-600 hover:bg-green-500 text-white transition-colors shadow shadow-green-600/30"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Confirmar venta
          </button>
        )}

        {/* Anular venta */}
        {estado !== 'anulada' && (
          <button
            onClick={() => { setAnularMotivo(''); setAnularError(''); setAnularOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/60
              transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Anular venta
          </button>
        )}

        {/* Editar venta (carrito completo) */}
        {estado !== 'anulada' && (
          <a
            href={`/ventas/${ventaId}/editar`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/60
              transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </a>
        )}

        {/* Editar observaciones */}
        {estado !== 'anulada' && (
          <button
            onClick={() => { setEditObsText(observaciones ?? ''); setEditObsError(''); setEditObsOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray
              transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Observaciones
          </button>
        )}

        {/* Imprimir venta */}
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
            border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray
            transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Imprimir venta
        </button>

        {/* Imprimir factura — solo cuando tiene CAE */}
        {yaFacturada && (
          <button
            onClick={() => {
              document.body.classList.add('print-factura');
              window.print();
              window.addEventListener('afterprint', () => {
                document.body.classList.remove('print-factura');
              }, { once: true });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              border border-blue-500/50 text-blue-400 hover:text-blue-300 hover:border-blue-400
              transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Imprimir factura
          </button>
        )}

        {/* Factura oficial — deshabilitada */}
        <div className="relative group">
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              border border-kp-border/40 text-kp-gray/30 cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Factura Oficial
          </button>
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 z-10
            bg-kp-surface2 border border-kp-border rounded text-xs text-kp-gray whitespace-nowrap
            opacity-0 group-hover:opacity-100 transition-opacity">
            Próximamente — requiere clave fiscal ARCA
          </span>
        </div>

        {/* Factura test ARCA */}
        {!yaFacturada && (
          <button
            onClick={generarFacturaTest}
            disabled={loadingFactura}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              bg-kp-red hover:bg-kp-red-dark text-white transition-colors shadow shadow-kp-red/30
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingFactura ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            )}
            Factura Test ARCA
          </button>
        )}

      </div>

      {/* Resultado factura test */}
      {resultFactura && (
        <div className={`text-xs px-3 py-2 rounded-lg border max-w-sm ${
          resultFactura.error
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {resultFactura.error ? (
            <>Error: {resultFactura.error}</>
          ) : (
            <>
              CAE: <span className="font-mono font-bold">{resultFactura.CAE}</span>
              {resultFactura._mock && <span className="ml-2 opacity-60">(simulado)</span>}
            </>
          )}
        </div>
      )}
    </div>

    {anularOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-rose-500 rounded-full block" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-rose-400">Anular Venta</h3>
            </div>
            <button onClick={() => setAnularOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">×</button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Esta acción es irreversible. El stock de los artículos será restaurado automáticamente.
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1">Motivo de anulación *</label>
              <textarea
                value={anularMotivo}
                onChange={e => setAnularMotivo(e.target.value)}
                rows={3}
                placeholder="Ej: Error en los artículos cargados, pedido cancelado por el cliente..."
                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-rose-500 transition-colors resize-none"
              />
            </div>
            {anularError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{anularError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAnular}
                disabled={anularLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {anularLoading ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : null}
                {anularLoading ? 'Anulando…' : 'Confirmar Anulación'}
              </button>
              <button
                onClick={() => setAnularOpen(false)}
                className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {editObsOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-kp-red rounded-full block" />
              <h3 className="text-sm font-bold uppercase tracking-wide">Editar Observaciones</h3>
            </div>
            <button onClick={() => setEditObsOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">×</button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1">Observaciones</label>
              <textarea
                value={editObsText}
                onChange={e => setEditObsText(e.target.value)}
                rows={4}
                placeholder="Observaciones opcionales…"
                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors resize-none"
              />
            </div>
            {editObsError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{editObsError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleEditObs}
                disabled={editObsLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kp-red hover:bg-kp-red/90 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {editObsLoading ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : null}
                {editObsLoading ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditObsOpen(false)}
                className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Modal: Confirmar Preventa ── */}
    {confirmarOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-surface2">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-green-500 rounded-full block" />
              <h3 className="text-sm font-bold uppercase tracking-wide">Confirmar Venta</h3>
            </div>
            <button onClick={() => setConfirmarOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">×</button>
          </div>
          <div className="p-6 space-y-4">

            {/* Total a pagar */}
            <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
              <span className="text-xs text-kp-gray uppercase tracking-widest">Total de la venta</span>
              <span className="font-bold tabular-nums text-kp-white">{ars.format(totalVenta)}</span>
            </div>

            {/* Medios de pago */}
            <div className="space-y-2">
              <label className="block text-xs text-kp-gray uppercase tracking-widest">Métodos de Pago *</label>
              {mediosPago.length === 0 ? (
                <div className="text-xs text-kp-gray italic px-1">Cargando...</div>
              ) : (
                <>
                  {pagos.map((pago, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={pago.medio_pago_id}
                        onChange={e => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, medio_pago_id: e.target.value } : p))}
                        className="flex-1 bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-green-500"
                      >
                        {mediosPago.map(mp => <option key={mp.id} value={mp.id}>{mp.nombre}</option>)}
                      </select>
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={pago.monto}
                          onChange={e => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, monto: e.target.value } : p))}
                          placeholder="0.00"
                          className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-2 py-2 text-sm text-kp-white focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setPagos(prev => prev.filter((_, i) => i !== idx))}
                        className="text-kp-gray hover:text-rose-400 transition-colors p-1 flex-shrink-0"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarPagoConfirmar}
                    className="text-xs text-green-400 hover:text-green-300 font-semibold transition-colors flex items-center gap-1"
                  >
                    + Agregar método
                  </button>
                </>
              )}
            </div>

            {/* Balance */}
            {pagos.length > 0 && totalPagos > 0 && (
              <div className={`flex justify-between items-center rounded-xl border px-4 py-3 ${
                Math.abs(totalPagos - totalVenta) < 0.01
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}>
                <span className="text-xs text-kp-gray uppercase tracking-widest">Total ingresado</span>
                <span className={`font-bold tabular-nums ${Math.abs(totalPagos - totalVenta) < 0.01 ? 'text-green-400' : 'text-amber-400'}`}>
                  {ars.format(totalPagos)}
                </span>
              </div>
            )}

            {confirmarError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{confirmarError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleConfirmar}
                disabled={confirmarLoading || pagos.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {confirmarLoading
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Confirmando…</>
                  : <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>Confirmar</>
                }
              </button>
              <button
                onClick={() => setConfirmarOpen(false)}
                className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
