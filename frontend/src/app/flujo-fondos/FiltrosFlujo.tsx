'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inputCls, labelCls, btnPrimary, btnSecondary, helpCls } from '@/lib/ui';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;

interface Props {
  desde: string;
  hasta: string;
  inflacion: number;   // fracción (0.02 = 2%)
  crecimiento: number; // fracción
  mesMax: string;
}

// Período (meses) + supuestos de la proyección, y descarga de la planilla con
// los mismos parámetros que se están viendo.
export default function FiltrosFlujo({ desde, hasta, inflacion, crecimiento, mesMax }: Props) {
  const router = useRouter();
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);
  const [inf, setInf] = useState(String(+(inflacion * 100).toFixed(2)));
  const [cre, setCre] = useState(String(+(crecimiento * 100).toFixed(2)));
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = () => {
    const p = new URLSearchParams();
    p.set('desde', d);
    p.set('hasta', h);
    p.set('inflacion', String((parseFloat(inf.replace(',', '.')) || 0) / 100));
    p.set('crecimiento', String((parseFloat(cre.replace(',', '.')) || 0) / 100));
    return p.toString();
  };

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    if (d > h) { setError('El mes "desde" no puede ser posterior al mes "hasta"'); return; }
    setError(null);
    router.push(`/flujo-fondos?${query()}`);
  }

  async function exportar() {
    setDescargando(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/flujo-fondos/excel?${query()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'No se pudo generar la planilla');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flujo-de-fondos-${d}_${h}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <form onSubmit={aplicar} className="space-y-2">
      <div className="grid grid-cols-2 md:flex md:flex-wrap md:items-end gap-3">
        <div>
          <label className={labelCls} htmlFor="ff-desde">Desde</label>
          <input id="ff-desde" type="month" value={d} max={mesMax} onChange={(e) => setD(e.target.value)}
            className={`${inputCls} [color-scheme:dark] md:w-40`} required />
        </div>
        <div>
          <label className={labelCls} htmlFor="ff-hasta">Hasta</label>
          <input id="ff-hasta" type="month" value={h} max={mesMax} onChange={(e) => setH(e.target.value)}
            className={`${inputCls} [color-scheme:dark] md:w-40`} required />
        </div>
        <div>
          <label className={labelCls} htmlFor="ff-inf">Inflación mensual %</label>
          <input id="ff-inf" type="number" step="0.1" min="-50" max="100" inputMode="decimal" value={inf}
            onChange={(e) => setInf(e.target.value)} className={`${inputCls} md:w-32`} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ff-cre">Crecimiento mensual %</label>
          <input id="ff-cre" type="number" step="0.1" min="-50" max="100" inputMode="decimal" value={cre}
            onChange={(e) => setCre(e.target.value)} className={`${inputCls} md:w-32`} />
        </div>
        <button type="submit" className={`${btnPrimary} col-span-1`}>Aplicar</button>
        <button type="button" onClick={exportar} disabled={descargando} className={`${btnSecondary} col-span-1`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 10v6m0 0-3-3m3 3 3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3M16 6l-4-4-4 4" />
          </svg>
          {descargando ? 'Generando…' : 'Exportar Excel'}
        </button>
      </div>
      <p className={helpCls}>Inflación y crecimiento solo afectan la proyección. La planilla exportada usa los valores de los campos.</p>
      {error && <p role="alert" className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/20 rounded-lg px-3 py-2">{error}</p>}
    </form>
  );
}
