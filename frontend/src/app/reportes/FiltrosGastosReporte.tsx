'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Rubro { id: string; nombre: string; }

interface Props {
  fechaDesde: string;
  fechaHasta: string;
  rubroId?:   string;
  rubros:     Rubro[];
}

export default function FiltrosGastosReporte({ fechaDesde, fechaHasta, rubroId, rubros }: Props) {
  const router = useRouter();
  const [desde, setDesde]   = useState(fechaDesde);
  const [hasta, setHasta]   = useState(fechaHasta);
  const [rubro, setRubro]   = useState(rubroId ?? '');

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams({ tab: 'gastos' });
    if (desde) p.set('fecha_desde', desde);
    if (hasta) p.set('fecha_hasta', hasta);
    if (rubro) p.set('rubro_id', rubro);
    router.push(`/reportes?${p}`);
  }

  function setPreset(tipo: 'hoy' | 'mes' | 'mes_ant') {
    const hoy = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (tipo === 'hoy') { setDesde(iso(hoy)); setHasta(iso(hoy)); }
    else if (tipo === 'mes') {
      setDesde(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`);
      setHasta(iso(new Date(hoy.getFullYear(), hoy.getMonth()+1, 0)));
    } else {
      setDesde(iso(new Date(hoy.getFullYear(), hoy.getMonth()-1, 1)));
      setHasta(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)));
    }
  }

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-kp-gray">Desde</label>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red [color-scheme:dark]" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-kp-gray">Hasta</label>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red [color-scheme:dark]" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-kp-gray">Rubro</label>
        <select value={rubro} onChange={e => setRubro(e.target.value)}
          className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red min-w-[180px]">
          <option value="">Todos los rubros</option>
          {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </div>
      <button type="submit"
        className="px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 transition-colors">
        Aplicar
      </button>
      <div className="flex items-end gap-2">
        {(['hoy','mes','mes_ant'] as const).map(t => (
          <button key={t} type="button" onClick={() => setPreset(t)}
            className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-xs font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors">
            {t === 'hoy' ? 'Hoy' : t === 'mes' ? 'Este mes' : 'Mes anterior'}
          </button>
        ))}
      </div>
    </form>
  );
}
