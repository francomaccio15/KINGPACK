'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

interface CategoriaCierre {
  categoria_id: string;
  categoria:    string;
  orden:        number;
  seccion:      string;
  monto_actual: number;
  confirmado:   boolean;
}

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CierreMensual({ anio, mes }: { anio: number; mes: number }) {
  const router = useRouter();
  const [cats, setCats]       = useState<CategoriaCierre[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await apiFetch(`/api/reportes/estado-resultados/cierre?anio=${anio}&mes=${mes}`);
    if (res.ok) {
      const data = await res.json();
      setCats(data.categorias || []);
    }
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  async function confirmar(categoria_resultado_id: string) {
    setBusy(categoria_resultado_id);
    await apiFetch('/api/reportes/estado-resultados/cierre/confirmar', {
      method: 'POST',
      body: JSON.stringify({ anio, mes, categoria_resultado_id }),
    });
    await cargar();
    setBusy(null);
  }

  async function reabrir(categoria_resultado_id: string) {
    setBusy(categoria_resultado_id);
    await apiFetch('/api/reportes/estado-resultados/cierre/reabrir', {
      method: 'POST',
      body: JSON.stringify({ anio, mes, categoria_resultado_id }),
    });
    await cargar();
    setBusy(null);
  }

  const faltan = cats.filter(c => !c.confirmado).length;
  const listo  = cats.length > 0 && faltan === 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface p-8 text-center">
        <p className="text-kp-gray text-sm">Cargando cierre mensual…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="rounded-xl border border-kp-border bg-kp-surface2 p-5">
        <h2 className="text-lg font-black text-kp-white tracking-tight">
          Cierre mensual — {MESES[mes - 1]} {anio}
        </h2>
        <p className="text-sm text-kp-gray mt-1">
          Antes de calcular el estado de resultados, confirmá cada categoría de gasto del mes.
          Si una no tuvo movimientos, confirmala en <span className="text-kp-white font-semibold">$0</span>.
          {faltan > 0
            ? <span className="text-orange-300 font-semibold"> Faltan confirmar {faltan} categoría{faltan !== 1 ? 's' : ''}.</span>
            : <span className="text-emerald-400 font-semibold"> Todas confirmadas.</span>}
        </p>
      </div>

      {/* Lista de categorías */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-kp-border bg-kp-surface2/60">
              <th className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-kp-gray">Categoría</th>
              <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-widest text-kp-gray">Monto del mes</th>
              <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-widest text-kp-gray w-64">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(c => (
              <tr key={c.categoria_id} className="border-b border-kp-border/40 hover:bg-kp-surface2/30 transition-colors">
                <td className="px-5 py-3 text-sm font-semibold text-kp-white">{c.categoria}</td>
                <td className={['px-5 py-3 text-sm text-right tabular-nums', c.monto_actual === 0 ? 'text-kp-gray/50' : 'text-kp-white'].join(' ')}>
                  {ars.format(c.monto_actual)}
                </td>
                <td className="px-5 py-3 text-right">
                  {c.confirmado ? (
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-emerald-400 text-sm font-semibold">✓ Confirmado</span>
                      <button
                        onClick={() => reabrir(c.categoria_id)}
                        disabled={busy === c.categoria_id}
                        className="text-xs text-kp-gray hover:text-orange-300 underline disabled:opacity-50">
                        reabrir
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => confirmar(c.categoria_id)}
                      disabled={busy === c.categoria_id}
                      className="px-3 py-1.5 rounded-lg bg-kp-red text-white text-xs font-semibold hover:bg-kp-red/80 transition-colors disabled:opacity-50">
                      {busy === c.categoria_id
                        ? 'Guardando…'
                        : c.monto_actual === 0 ? 'Marcar en $0 y confirmar' : 'Confirmar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Acción final */}
      {listo && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-5 flex items-center justify-between">
          <p className="text-sm text-emerald-300 font-semibold">
            Todas las categorías están confirmadas. Ya podés calcular el estado de resultados.
          </p>
          <button
            onClick={() => router.refresh()}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors">
            Ver estado de resultados
          </button>
        </div>
      )}
    </div>
  );
}
