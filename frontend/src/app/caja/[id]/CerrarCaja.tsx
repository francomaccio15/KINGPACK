'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, {
    ...o,
    headers: {
      'Content-Type': 'application/json',
      ...((o.headers as Record<string, string>) || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

type CierreData = {
  saldo_final_real: number;
  saldo_final_sistema: number;
  diferencia: number;
};

export default function CerrarCaja({
  cajaId,
  saldoSistema,
  fullWidth = false,
  saldoInicial,
  sucursalNombre,
  fechaApertura,
}: {
  cajaId: string;
  saldoSistema: number;
  fullWidth?: boolean;
  saldoInicial?: number;
  sucursalNombre?: string;
  fechaApertura?: string;
}) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [retiro, setRetiro]   = useState('');
  const [fondo, setFondo]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [cierre, setCierre]   = useState<CierreData | null>(null);

  const retiroNum      = parseFloat(retiro) || 0;
  const fondoNum       = parseFloat(fondo)  || 0;
  const saldoRealNum   = retiroNum + fondoNum;
  const diferencia     = saldoSistema - saldoRealNum;
  const hayDiferencia  = Math.abs(diferencia) > 0.01;
  const hayAlgunValor  = retiro !== '' || fondo !== '';

  const handleCerrar = async () => {
    if (!hayAlgunValor) { setError('Ingresá el retiro y/o el fondo de caja'); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/caja/${cajaId}/cerrar`, {
        method: 'POST',
        body: JSON.stringify({ saldo_final_real: saldoRealNum }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al cerrar'); return; }
      setCierre(data.caja);
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenModal = () => {
    setRetiro('');
    setFondo('');
    setError(null);
    setCierre(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    if (cierre) {
      setCierre(null);
      router.refresh();
    }
  };

  const handleImprimir = () => {
    if (!cierre) return;

    const sistema = parseFloat(String(cierre.saldo_final_sistema));
    const diff    = parseFloat(String(cierre.diferencia));
    const diffOk  = Math.abs(diff) < 0.01;

    const aperturaStr = fechaApertura
      ? new Date(fechaApertura).toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';
    const cierreStr = new Date().toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const diffLabel = diffOk ? 'CUADRADA' : diff > 0 ? '▼ FALTA' : '▲ SOBRA';
    const diffValue = diffOk
      ? '—'
      : `${diff > 0 ? '−' : '+'}${ars.format(Math.abs(diff))}`;
    const diffColor = diffOk ? '#6b7280' : diff > 0 ? '#ef4444' : '#f59e0b';

    const row = (label: string, value: string, bold = false, color = '#111') =>
      `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:7px 10px;color:#6b7280;font-size:13px">${label}</td>
        <td style="padding:7px 10px;text-align:right;font-size:13px;font-weight:${bold ? '700' : '500'};color:${color};font-variant-numeric:tabular-nums">${value}</td>
      </tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Cierre de Caja — ${sucursalNombre ?? ''}</title>
      <style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111}
        @media print{@page{margin:12mm}body{padding:0}}</style>
    </head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px">
        <div>
          <p style="font-size:17px;font-weight:800;letter-spacing:1px;margin:0">KING PACK DESCARTABLES</p>
          <p style="font-size:11px;color:#6b7280;margin:4px 0 0">CIERRE DE CAJA</p>
        </div>
        <div style="text-align:right;font-size:12px;line-height:1.7">
          <p style="margin:0"><strong>Sucursal:</strong> ${sucursalNombre ?? '—'}</p>
          <p style="margin:0"><strong>Apertura:</strong> ${aperturaStr}</p>
          <p style="margin:0"><strong>Cierre:</strong> ${cierreStr}</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tbody>
          ${row('Saldo inicial', ars.format(saldoInicial ?? 0))}
          ${row('Saldo sistema', ars.format(sistema))}
          <tr><td colspan="2" style="padding:6px 0 2px 10px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px">Arqueo de efectivo</td></tr>
          ${row('Retiro (me llevo)', ars.format(retiroNum))}
          ${row('Fondo (dejo en caja)', ars.format(fondoNum))}
          ${row('Total contado', ars.format(saldoRealNum), true)}
          ${row(diffLabel, diffValue, true, diffColor)}
        </tbody>
      </table>

      ${!diffOk ? `<p style="font-size:12px;color:${diffColor};text-align:center;margin-bottom:16px">
        ${diff > 0
          ? `Faltan ${ars.format(Math.abs(diff))} respecto del sistema.`
          : `Sobran ${ars.format(Math.abs(diff))} respecto del sistema.`}
      </p>` : `<p style="font-size:12px;color:#22c55e;text-align:center;margin-bottom:16px">✓ Caja cuadrada</p>`}

      <p style="font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:8px;margin:0">
        KingPack · Generado el ${cierreStr}
      </p>
    </body></html>`;

    const win = window.open('', '_blank', 'width=620,height=540');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  const cierreReal    = cierre ? parseFloat(String(cierre.saldo_final_real))    : 0;
  const cierreSistema = cierre ? parseFloat(String(cierre.saldo_final_sistema)) : 0;
  const cierreDiff    = cierre ? parseFloat(String(cierre.diferencia))          : 0;
  const diffOk        = Math.abs(cierreDiff) < 0.01;

  return (
    <>
      <button
        onClick={handleOpenModal}
        className={[
          'flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors',
          fullWidth ? 'w-full' : '',
        ].join(' ')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        Cerrar Caja
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {cierre ? 'Caja Cerrada ✓' : 'Cerrar Caja — Arqueo'}
                </h3>
              </div>
              <button onClick={handleClose} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {cierre ? (
              /* ── Success view ── */
              <div className="p-5 space-y-4">

                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Caja cerrada correctamente
                </div>

                {/* Saldo sistema */}
                <div className="bg-kp-surface2 border border-kp-border rounded-lg p-3 flex justify-between items-center">
                  <p className="text-xs text-kp-gray">Saldo sistema</p>
                  <p className="text-sm font-bold tabular-nums text-kp-white">{ars.format(cierreSistema)}</p>
                </div>

                {/* Desglose retiro + fondo */}
                <div className="bg-kp-surface2 border border-kp-border rounded-xl overflow-hidden divide-y divide-kp-border">
                  <div className="flex justify-between items-center px-3 py-2.5">
                    <p className="text-xs text-kp-gray">Retiro (me llevo)</p>
                    <p className="text-sm font-semibold tabular-nums text-kp-white">{ars.format(retiroNum)}</p>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2.5">
                    <p className="text-xs text-kp-gray">Fondo (dejo en caja)</p>
                    <p className="text-sm font-semibold tabular-nums text-kp-white">{ars.format(fondoNum)}</p>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2.5 bg-kp-border/10">
                    <p className="text-xs font-bold text-kp-gray uppercase tracking-widest">Total contado</p>
                    <p className="text-sm font-bold tabular-nums text-kp-white">{ars.format(cierreReal)}</p>
                  </div>
                </div>

                {/* Diferencia */}
                <div className={`border rounded-lg p-3 flex justify-between items-center ${
                  diffOk
                    ? 'bg-green-500/10 border-green-500/30'
                    : cierreDiff > 0
                      ? 'bg-kp-red/10 border-kp-red/30'
                      : 'bg-amber-500/10 border-amber-500/30'
                }`}>
                  <p className={`text-xs font-bold uppercase tracking-widest ${
                    diffOk ? 'text-green-400' : cierreDiff > 0 ? 'text-kp-red' : 'text-amber-400'
                  }`}>
                    {diffOk ? '✓ Cuadrada' : cierreDiff > 0 ? '▼ FALTA' : '▲ SOBRA'}
                  </p>
                  <p className={`text-sm font-bold tabular-nums ${
                    diffOk ? 'text-green-400' : cierreDiff > 0 ? 'text-kp-red' : 'text-amber-400'
                  }`}>
                    {diffOk ? '—' : `${cierreDiff > 0 ? '−' : '+'}${ars.format(Math.abs(cierreDiff))}`}
                  </p>
                </div>

                {/* Botones */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleImprimir}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-white text-sm font-semibold hover:border-kp-gray transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Imprimir cierre
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              /* ── Form ── */
              <div className="p-5 space-y-4">

                {/* Saldo sistema (read-only) */}
                <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-0.5">Saldo sistema</p>
                    <p className="text-xs text-kp-gray/60">Calculado automáticamente</p>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-kp-white">
                    {ars.format(saldoSistema)}
                  </p>
                </div>

                {/* Retiro */}
                <div>
                  <label className={labelCls}>Retiro — lo que te llevás *</label>
                  <NumericInput
                    placeholder="0.00"
                    value={retiro}
                    onChange={e => setRetiro(e.target.value)}
                    autoFocus
                    className={inputCls}
                  />
                </div>

                {/* Fondo */}
                <div>
                  <label className={labelCls}>Fondo de caja — lo que dejás *</label>
                  <NumericInput
                    placeholder="0.00"
                    value={fondo}
                    onChange={e => setFondo(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Total en tiempo real */}
                {hayAlgunValor && (
                  <div className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2.5 flex justify-between items-center">
                    <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold">Total contado</p>
                    <p className="text-sm font-bold tabular-nums text-kp-white">{ars.format(saldoRealNum)}</p>
                  </div>
                )}

                {/* Diferencia en tiempo real */}
                {hayAlgunValor && (
                  <div className={[
                    'rounded-xl border p-3',
                    !hayDiferencia
                      ? 'border-green-500/30 bg-green-500/5'
                      : diferencia > 0
                        ? 'border-kp-red/30 bg-kp-red/5'
                        : 'border-amber-500/30 bg-amber-500/5',
                  ].join(' ')}>
                    <div className="flex justify-between items-center">
                      <p className={[
                        'text-xs font-semibold uppercase tracking-widest',
                        !hayDiferencia ? 'text-kp-gray'
                          : diferencia > 0 ? 'text-kp-red'
                          : 'text-amber-400',
                      ].join(' ')}>
                        {!hayDiferencia ? 'Caja cuadrada' : diferencia > 0 ? '▼ FALTA' : '▲ SOBRA'}
                      </p>
                      <p className={[
                        'text-lg font-bold tabular-nums',
                        !hayDiferencia ? 'text-green-400'
                          : diferencia > 0 ? 'text-kp-red'
                          : 'text-amber-400',
                      ].join(' ')}>
                        {hayDiferencia && (diferencia > 0 ? '−' : '+')}{ars.format(Math.abs(diferencia))}
                      </p>
                    </div>
                    {hayDiferencia && (
                      <p className={`text-xs mt-1.5 ${diferencia > 0 ? 'text-kp-red/90' : 'text-amber-400/90'}`}>
                        {diferencia > 0
                          ? `Hay ${ars.format(Math.abs(diferencia))} MENOS que lo que indica el sistema.`
                          : `Hay ${ars.format(Math.abs(diferencia))} MÁS que lo que indica el sistema.`}
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCerrar}
                    disabled={saving || !hayAlgunValor}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? <><Spinner /> Cerrando…</> : 'Confirmar Cierre'}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
