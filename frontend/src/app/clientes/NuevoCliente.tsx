'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';
import Modal from '@/components/ui/Modal';
import {
  btnFullMobile, btnPrimary, btnSecondary, cn, errorCls, inputCls, labelCls, selectCls,
} from '@/lib/ui';

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
        className={cn(btnPrimary, 'w-full sm:w-auto')}
      >
        <span className="text-lg leading-none">+</span> Nuevo Cliente
      </button>

      <Modal
        open={open}
        onClose={cerrar}
        title="Nuevo Cliente"
        size="md"
        as="form"
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" onClick={cerrar} className={cn(btnSecondary, btnFullMobile)}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={cn(btnPrimary, btnFullMobile)}>
              {loading ? 'Guardando…' : 'Guardar Cliente'}
            </button>
          </>
        }
      >
        {/* Razón social */}
        <div>
          <label className={labelCls}>Razón Social *</label>
          <input
            required value={form.razon_social} onChange={set('razon_social')}
            placeholder="Nombre o razón social"
            className={inputCls}
          />
        </div>

        {/* CUIT + Cond IVA */}
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>CUIT</label>
            <input
              value={form.cuit} onChange={set('cuit')}
              placeholder="20-12345678-9"
              inputMode="numeric" autoComplete="off" autoCapitalize="off"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Condición IVA *</label>
            <select required value={form.cond_iva_id} onChange={set('cond_iva_id')} className={selectCls}>
              {condIva.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Teléfono + Sucursal */}
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Teléfono</label>
            <input
              value={form.telefono} onChange={set('telefono')}
              placeholder="387 000-0000"
              inputMode="tel" autoComplete="off"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Sucursal</label>
            <select value={form.sucursal_default_id} onChange={set('sucursal_default_id')} className={selectCls}>
              <option value="">— Sin asignar</option>
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Dirección */}
        <div>
          <label className={labelCls}>Dirección</label>
          <input
            value={form.direccion} onChange={set('direccion')}
            placeholder="Calle 123, Salta"
            className={inputCls}
          />
        </div>

        {/* Lista de precios */}
        <div>
          <label className={labelCls}>Lista de Precios</label>
          <select value={form.lista_precio_id} onChange={set('lista_precio_id')} className={selectCls}>
            <option value="">— Sin lista asignada</option>
            {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>

        {/* Límite crédito + Descuento + Saldo inicial */}
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Límite Crédito</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs pointer-events-none">$</span>
              <NumericInput
                value={form.limite_credito} onChange={set('limite_credito')}
                placeholder="0"
                className={cn(inputCls, 'pl-7')}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Descuento %</label>
            <div className="relative">
              <NumericInput
                value={form.descuento_adicional} onChange={set('descuento_adicional')}
                placeholder="0"
                className={cn(inputCls, 'pr-7')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs pointer-events-none">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Saldo Inicial</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs pointer-events-none">$</span>
              <NumericInput
                value={form.saldo_inicial} onChange={set('saldo_inicial')}
                placeholder="0"
                className={cn(inputCls, 'pl-7')}
              />
            </div>
          </div>
        </div>

        {error && <p className={errorCls}>{error}</p>}
      </Modal>
    </>
  );
}
