'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

type CondIva  = { id: string; nombre: string };
type Lista    = { id: string; nombre: string };
type Sucursal = { id: string; nombre: string };

type Cliente = {
  id: string;
  razon_social: string;
  cuit: string | null;
  cond_iva_id: string;
  telefono: string | null;
  direccion: string | null;
  sucursal_default_id: string | null;
  lista_precio_id: string | null;
  limite_credito: string;
  descuento_adicional: string;
  activo: boolean;
};

export default function EditarCliente({
  cliente, condIva, listas, sucursales,
}: {
  cliente: Cliente;
  condIva: CondIva[];
  listas: Lista[];
  sucursales: Sucursal[];
}) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    razon_social:        cliente.razon_social,
    cuit:                cliente.cuit ?? '',
    cond_iva_id:         cliente.cond_iva_id,
    telefono:            cliente.telefono ?? '',
    direccion:           cliente.direccion ?? '',
    sucursal_default_id: cliente.sucursal_default_id ?? '',
    lista_precio_id:     cliente.lista_precio_id ?? '',
    limite_credito:      parseFloat(cliente.limite_credito || '0').toString(),
    descuento_adicional: parseFloat(cliente.descuento_adicional || '0').toString(),
    activo:              cliente.activo,
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      setForm(f => ({ ...f, [k]: val }));
    };

  const cerrar = () => { setOpen(false); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes/${cliente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razon_social:        form.razon_social.trim(),
          cuit:                form.cuit.trim() || null,
          cond_iva_id:         form.cond_iva_id,
          telefono:            form.telefono.trim() || null,
          direccion:           form.direccion.trim() || null,
          sucursal_default_id: form.sucursal_default_id || null,
          lista_precio_id:     form.lista_precio_id || null,
          limite_credito:      parseFloat(form.limite_credito) || 0,
          descuento_adicional: parseFloat(form.descuento_adicional) || 0,
          activo:              form.activo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border
          text-kp-gray hover:text-kp-white hover:border-kp-gray text-sm font-medium transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Editar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-lg bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Editar Cliente</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

              {/* Razón social */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Razón Social *</label>
                <input
                  required value={form.razon_social} onChange={set('razon_social')}
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                />
              </div>

              {/* CUIT + Cond IVA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">CUIT</label>
                  <input
                    value={form.cuit} onChange={set('cuit')}
                    placeholder="20-12345678-9"
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Condición IVA *</label>
                  <select
                    required value={form.cond_iva_id} onChange={set('cond_iva_id')}
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      focus:outline-none focus:border-kp-red transition-colors"
                  >
                    {condIva.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              {/* Teléfono + Sucursal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Teléfono</label>
                  <input
                    value={form.telefono} onChange={set('telefono')}
                    placeholder="387 000-0000"
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Sucursal</label>
                  <select
                    value={form.sucursal_default_id} onChange={set('sucursal_default_id')}
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      focus:outline-none focus:border-kp-red transition-colors"
                  >
                    <option value="">— Sin asignar</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Dirección</label>
                <input
                  value={form.direccion} onChange={set('direccion')}
                  placeholder="Calle 123, Salta"
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                />
              </div>

              {/* Lista de precios */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Lista de Precios</label>
                <select
                  value={form.lista_precio_id} onChange={set('lista_precio_id')}
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    focus:outline-none focus:border-kp-red transition-colors"
                >
                  <option value="">— Sin lista asignada</option>
                  {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>

              {/* Límite crédito + Descuento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Límite Crédito</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.limite_credito} onChange={set('limite_credito')}
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                        focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Descuento %</label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={form.descuento_adicional} onChange={set('descuento_adicional')}
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 pr-6 py-2 text-sm text-kp-white
                        focus:outline-none focus:border-kp-red transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
                  </div>
                </div>
              </div>

              {/* Estado activo */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox" className="sr-only"
                    checked={form.activo}
                    onChange={set('activo')}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${form.activo ? 'bg-kp-red' : 'bg-kp-surface2 border border-kp-border'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.activo ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-kp-gray-lt">Cliente activo</span>
              </label>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white hover:border-kp-gray transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {loading ? 'Guardando…' : 'Guardar Cambios'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
