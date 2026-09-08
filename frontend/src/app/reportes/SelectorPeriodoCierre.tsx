'use client';

import { useRouter } from 'next/navigation';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function SelectorPeriodoCierre({ anio, mes }: { anio: number; mes: number }) {
  const router = useRouter();

  const ir = (a: number, m: number) => {
    router.push(`/reportes?tab=er&anio=${a}&mes=${m}`);
  };

  const irRelativo = (delta: number) => {
    // delta en meses; normaliza el rollover de año
    const base = new Date(anio, mes - 1 + delta, 1);
    ir(base.getFullYear(), base.getMonth() + 1);
  };

  const hoy = new Date();
  const esFuturo = anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1);

  // Rango de años para el desplegable: desde 2024 hasta el año actual
  const anios: number[] = [];
  for (let a = hoy.getFullYear(); a >= 2024; a--) anios.push(a);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => irRelativo(-1)}
        title="Mes anterior"
        className="min-h-touch-sm px-2.5 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-sm font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors">
        ◀
      </button>

      <select
        value={mes}
        onChange={e => ir(anio, parseInt(e.target.value, 10))}
        className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors [color-scheme:dark]">
        {MESES.map((nombre, i) => (
          <option key={i} value={i + 1}>{nombre}</option>
        ))}
      </select>

      <select
        value={anio}
        onChange={e => ir(parseInt(e.target.value, 10), mes)}
        className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors [color-scheme:dark]">
        {anios.map(a => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => irRelativo(1)}
        disabled={esFuturo}
        title="Mes siguiente"
        className="min-h-touch-sm px-2.5 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-sm font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        ▶
      </button>

      <button
        type="button"
        onClick={() => ir(hoy.getFullYear(), hoy.getMonth() + 1)}
        className="min-h-touch-sm px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-xs font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors">
        Mes actual
      </button>
    </div>
  );
}
