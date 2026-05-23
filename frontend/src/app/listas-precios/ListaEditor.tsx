'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lista = {
  id: string;
  nombre: string;
  tipo: string;
  descuento_base_pct: string;
  articulos_count: number;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const TIPO_LABEL: Record<string, string> = {
  madre:            'Precio Base',
  publica:          'Precio Público',
  revendedor:       'Lista Reventa',
  cuenta_corriente: 'Cuenta Corriente',
};

const TIPO_DESC: Record<string, string> = {
  madre:            'Precio de referencia. Todos los demás precios se calculan a partir de este.',
  publica:          'Precio de venta al público general.',
  revendedor:       'Precio especial para clientes revendedores.',
  cuenta_corriente: 'Precio para clientes con cuenta corriente habilitada.',
};

type Estado = 'idle' | 'saving' | 'ok' | 'error';

export default function ListaEditor({ lista }: { lista: Lista }) {
  const router = useRouter();

  const [descuento, setDescuento] = useState(parseFloat(lista.descuento_base_pct) || 0);
  const [estado, setEstado]       = useState<Estado>('idle');
  const [msg, setMsg]             = useState('');
  const esMadre = lista.tipo === 'madre';

  const handleGuardar = async () => {
    setEstado('saving');
    setMsg('');
    try {
      const r = await apiFetch(`/api/listas-precios/${lista.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descuento_base_pct: descuento }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `Error ${r.status}`);
      setMsg(`✓ ${body.articulos_actualizados} artículo${body.articulos_actualizados !== 1 ? 's' : ''} actualizados`);
      setEstado('ok');
      router.refresh();
      setTimeout(() => setEstado('idle'), 3000);
    } catch (e: any) {
      setMsg(e.message || 'Error al guardar');
      setEstado('error');
    }
  };

  const precioEjemplo = 1000 * (1 - descuento / 100);

  return (
    <div className="bg-kp-surface border border-kp-border rounded-xl p-6 space-y-5">

      {/* Header de la lista */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${esMadre ? 'bg-kp-red' : 'bg-kp-gray'}`} />
            <h3 className="font-bold text-kp-white uppercase tracking-wide text-sm">
              {TIPO_LABEL[lista.tipo] ?? lista.nombre}
            </h3>
            {esMadre && (
              <span className="text-[10px] bg-kp-red/20 text-kp-red border border-kp-red/30 rounded px-1.5 py-0.5 uppercase tracking-wide font-semibold">
                Referencia
              </span>
            )}
          </div>
          <p className="text-xs text-kp-gray pl-4">{TIPO_DESC[lista.tipo] ?? ''}</p>
        </div>
        <span className="text-xs text-kp-gray bg-kp-surface2 border border-kp-border rounded px-2 py-1 whitespace-nowrap">
          {lista.articulos_count} artículo{lista.articulos_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Editor de descuento */}
      <div className="border-t border-kp-border pt-5">
        {esMadre ? (
          <p className="text-xs text-kp-gray italic">
            El precio base no tiene descuento — es el precio madre calculado a partir de costo + margen + IVA.
            Los demás precios se derivan de este.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-6">
              {/* Input de descuento */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-wide mb-1.5">
                  Descuento sobre precio base
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0} max={100} step={0.5}
                    value={descuento}
                    onChange={e => {
                      setDescuento(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)));
                      setEstado('idle');
                    }}
                    className="w-28 bg-kp-surface2 border border-kp-border rounded-lg px-4 py-2 text-lg font-bold text-kp-white focus:outline-none focus:border-kp-red tabular-nums"
                  />
                  <span className="text-lg font-bold text-kp-gray">%</span>
                </div>
              </div>

              {/* Fórmula / preview */}
              <div className="text-xs text-kp-gray space-y-1">
                <p className="font-semibold text-kp-gray-lt uppercase tracking-wide">Fórmula</p>
                <p>
                  Precio = Precio Base × (1 − {descuento.toFixed(1)}%)
                </p>
                <p className="text-kp-gray-lt">
                  Ej: $1.000 → <strong className="text-kp-white">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })
                      .format(precioEjemplo)}
                  </strong>
                </p>
              </div>
            </div>

            {/* Botón y feedback */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleGuardar}
                disabled={estado === 'saving'}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-kp-red hover:bg-kp-red-dark text-kp-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {estado === 'saving' ? 'Guardando…' : 'Guardar y aplicar'}
              </button>

              {msg && (
                <span className={`text-xs font-medium ${estado === 'ok' ? 'text-green-400' : 'text-kp-red'}`}>
                  {msg}
                </span>
              )}
            </div>

            <p className="text-[11px] text-kp-gray">
              Al guardar, el descuento se aplica inmediatamente a todos los artículos de esta lista.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
