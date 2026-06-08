'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  fechaDesde: string;
  fechaHasta: string;
  tab?: string;
}

export default function FiltrosReportes({ fechaDesde, fechaHasta, tab }: Props) {
  const router = useRouter();
  const [desde, setDesde] = useState(fechaDesde);
  const [hasta, setHasta] = useState(fechaHasta);

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (desde) params.set('fecha_desde', desde);
    if (hasta) params.set('fecha_hasta', hasta);
    if (tab)   params.set('tab', tab);
    router.push(`/reportes?${params.toString()}`);
  }

  function pushWithTab(d: string, h: string) {
    const params = new URLSearchParams();
    if (d)   params.set('fecha_desde', d);
    if (h)   params.set('fecha_hasta', h);
    if (tab) params.set('tab', tab);
    router.push(`/reportes?${params.toString()}`);
  }

  function setMesActual() {
    const hoy = new Date();
    const primer = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDate = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const ultimo = `${ultimoDate.getFullYear()}-${String(ultimoDate.getMonth() + 1).padStart(2, '0')}-${String(ultimoDate.getDate()).padStart(2, '0')}`;
    setDesde(primer); setHasta(ultimo);
    pushWithTab(primer, ultimo);
  }

  function setMesAnterior() {
    const hoy = new Date();
    const primerDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const ultimoDate = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDesde(toIso(primerDate)); setHasta(toIso(ultimoDate));
    pushWithTab(toIso(primerDate), toIso(ultimoDate));
  }

  function setHoy() {
    const hoy = new Date().toISOString().slice(0, 10);
    setDesde(hoy); setHasta(hoy);
    pushWithTab(hoy, hoy);
  }

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-kp-gray">
          Desde
        </label>
        <input
          type="date"
          value={desde}
          onChange={e => setDesde(e.target.value)}
          className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors [color-scheme:dark]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-kp-gray">
          Hasta
        </label>
        <input
          type="date"
          value={hasta}
          onChange={e => setHasta(e.target.value)}
          className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors [color-scheme:dark]"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 transition-colors"
      >
        Aplicar
      </button>
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={setHoy}
          className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-xs font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={setMesActual}
          className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-xs font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors"
        >
          Este mes
        </button>
        <button
          type="button"
          onClick={setMesAnterior}
          className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-xs font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors"
        >
          Mes anterior
        </button>
      </div>
    </form>
  );
}
