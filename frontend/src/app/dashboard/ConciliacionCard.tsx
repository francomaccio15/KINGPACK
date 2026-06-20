'use client';

import { useEffect, useState } from 'react';
import NumericInput from '@/components/NumericInput';

type Data = {
  periodo:         string;        // YYYY-MM-01
  facturado_arca:  number;
  monto_acreditado: number | null;
  diferencia:      number | null;
  observacion:     string | null;
  actualizado_en:  string | null;
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

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ConciliacionCard() {
  const [data, setData]       = useState<Data | null>(null);
  const [monto, setMonto]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState<{ t: 'ok' | 'err'; m: string } | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/conciliacion');
      if (!r.ok) { setData(null); return; }
      const d: Data = await r.json();
      setData(d);
      setMonto(d.monto_acreditado != null ? String(d.monto_acreditado) : '');
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // Si el rol no puede ver conciliación (403) o falló, no renderizamos nada.
  if (loading || !data) return null;

  const [y, m] = data.periodo.split('-');
  const label  = `${MESES[parseInt(m, 10) - 1]} ${y}`;
  const montoNum = parseFloat(monto);
  const dif    = Number.isFinite(montoNum) ? montoNum - data.facturado_arca : null;
  const coincide = dif !== null && Math.abs(dif) < 0.01;

  const guardar = async () => {
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      setMsg({ t: 'err', m: 'Ingresá un monto válido' });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      const r = await apiFetch('/api/conciliacion', {
        method: 'PUT',
        body: JSON.stringify({ periodo: data.periodo, monto_acreditado: montoNum }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al guardar');
      setMsg({ t: 'ok', m: 'Guardado' });
      await cargar();
    } catch (e: any) {
      setMsg({ t: 'err', m: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-kp-border bg-kp-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-kp-red rounded-full block" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-kp-white">Conciliación bancaria</h3>
            <p className="text-[11px] text-kp-gray mt-0.5">
              Acreditado en banco vs facturado en ARCA · {label}
            </p>
          </div>
        </div>
        {data.actualizado_en && (
          <span className="text-[10px] text-kp-gray/60">
            Actualizado {new Date(data.actualizado_en).toLocaleDateString('es-AR')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Facturado ARCA */}
        <div className="rounded-lg bg-kp-surface2 border border-kp-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-widest text-kp-gray mb-1">Facturado en ARCA</p>
          <p className="text-xl font-bold tabular-nums text-kp-white">{ars.format(data.facturado_arca)}</p>
        </div>

        {/* Acreditado en banco (editable) */}
        <div className="rounded-lg bg-kp-surface2 border border-kp-border px-4 py-3">
          <label className="block text-[11px] uppercase tracking-widest text-kp-gray mb-1">Acreditado en banco</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
            <NumericInput
              value={monto}
              onChange={e => { setMonto(e.target.value); setMsg(null); }}
              placeholder="0"
              className="w-full bg-kp-surface border border-kp-border rounded-lg pl-6 pr-3 py-2 text-lg font-bold tabular-nums text-kp-white
                placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
            />
          </div>
        </div>

        {/* Diferencia */}
        <div className={[
          'rounded-lg border px-4 py-3',
          dif === null ? 'bg-kp-surface2 border-kp-border'
            : coincide ? 'bg-emerald-950/30 border-emerald-700/50'
            : 'bg-amber-950/30 border-amber-700/50',
        ].join(' ')}>
          <p className="text-[11px] uppercase tracking-widest text-kp-gray mb-1">Diferencia</p>
          <p className={[
            'text-xl font-bold tabular-nums',
            dif === null ? 'text-kp-gray' : coincide ? 'text-emerald-400' : 'text-amber-300',
          ].join(' ')}>
            {dif === null ? '—' : `${dif > 0 ? '+' : ''}${ars.format(dif)}`}
          </p>
          <p className="text-[10px] text-kp-gray mt-0.5">
            {dif === null ? 'Cargá el acreditado' : coincide ? 'Coincide con ARCA' : 'Banco − ARCA'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={guardar}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar conciliación'}
        </button>
        {msg && (
          <span className={['text-xs font-semibold', msg.t === 'ok' ? 'text-emerald-400' : 'text-kp-red'].join(' ')}>
            {msg.m}
          </span>
        )}
      </div>
    </section>
  );
}
