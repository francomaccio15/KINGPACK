'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

type CondIva  = { id: string; nombre: string };
type Lista    = { id: string; nombre: string };
type Sucursal = { id: string; nombre: string };

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const EMPTY = {
  razon_social: '', cuit: '', cond_iva_id: '', telefono: '', direccion: '',
  sucursal_default_id: '', lista_precio_id: '', limite_credito: '', descuento_adicional: '', saldo_inicial: '',
};

export default function NuevoCliente({
  condIva, listas, sucursales,
}: {
  condIva: CondIva[]; listas: Lista[]; sucursales: Sucursal[];
}) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState(EMPTY);

  useEffect(() => {
    const cf = condIva.find(c => c.nombre.toLowerCase().includes('consumidor')) ?? condIva[0];
    setForm(f => ({ ...f, cond_iva_id: cf?.id ?? '' }));
  }, [condIva]);

  const set = (k: keyof typeof EMPTY) =>
    (e: { target: { value: string } }) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const cerrar = () => { setOpen(false); setError(''); };

  const enviar = async (forzarCuitDuplicado: boolean) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes`, {
        method: 'POST',
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
          saldo_inicial:       parseFloat(form.saldo_inicial) || 0,
          forzar_cuit_duplicado: forzarCuitDuplicado,
        }),
      });
      const data = await res.json();

      // CUIT ya existente: no es un error, es un aviso. Confirmamos y reenviamos.
      if (res.status === 409 && data.cuit_duplicado) {
        setLoading(false);
        if (window.confirm(data.mensaje)) await enviar(true);
        return;
      }

      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enviar(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
          bg-kp-red hover:bg-kp-red-dark transition-colors text-white text-sm font-semibold
          shadow shadow-kp-red/30"
      >
        <span className="text-lg leading-none">+</span> Nuevo Cliente
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
                <h3 className="font-bold text-base uppercase tracking-wide">Nuevo Cliente</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

              {/* Razón social */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Razón Social *</label>
                <input
                  required value={form.razon_social} onChange={set('razon_social')}
                  placeholder="Nombre o razón social"
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

              {/* Límite crédito + Descuento + Saldo inicial */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Límite Crédito</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                    <NumericInput
                      value={form.limite_credito} onChange={set('limite_credito')}
                      placeholder="0"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Descuento %</label>
                  <div className="relative">
                    <NumericInput
                      value={form.descuento_adicional} onChange={set('descuento_adicional')}
                      placeholder="0"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 pr-6 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Saldo Inicial</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                    <NumericInput
                      value={form.saldo_inicial} onChange={set('saldo_inicial')}
                      placeholder="0"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                </div>
              </div>

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
                  {loading ? 'Guardando…' : 'Guardar Cliente'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
