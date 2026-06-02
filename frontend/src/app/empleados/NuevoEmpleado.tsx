'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Sucursal = { id: string; nombre: string };

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

const EMPTY = {
  nombre: '', dni: '', cargo: '', email: '',
  telefono: '', fecha_ingreso: '', salario: '', sucursal_id: '',
};

const inputCls = `w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
  placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors`;

export default function NuevoEmpleado({ sucursales }: { sucursales: Sucursal[] }) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [form,    setForm]    = useState(EMPTY);

  const set = (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const cerrar = () => { setOpen(false); setError(''); setForm(EMPTY); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/empleados', {
        method: 'POST',
        body: JSON.stringify({
          nombre:       form.nombre.trim(),
          dni:          form.dni.trim()          || null,
          cargo:        form.cargo.trim()        || null,
          email:        form.email.trim()        || null,
          telefono:     form.telefono.trim()     || null,
          fecha_ingreso: form.fecha_ingreso      || null,
          salario:      form.salario             ? parseFloat(form.salario) : null,
          sucursal_id:  form.sucursal_id,
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
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
          bg-kp-red hover:bg-kp-red-dark transition-colors text-white text-sm font-semibold
          shadow shadow-kp-red/30"
      >
        <span className="text-lg leading-none">+</span> Nuevo Empleado
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-lg bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-surface2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Nuevo Empleado</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

              {/* Nombre (requerido) */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Nombre completo *</label>
                <input
                  required value={form.nombre} onChange={set('nombre')}
                  placeholder="Ej: Juan Pérez"
                  className={inputCls}
                />
              </div>

              {/* DNI + Cargo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">DNI</label>
                  <input
                    value={form.dni} onChange={set('dni')}
                    placeholder="00.000.000"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Cargo</label>
                  <input
                    value={form.cargo} onChange={set('cargo')}
                    placeholder="Ej: Vendedor"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Email + Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Email</label>
                  <input
                    type="email" value={form.email} onChange={set('email')}
                    placeholder="correo@ejemplo.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Teléfono</label>
                  <input
                    value={form.telefono} onChange={set('telefono')}
                    placeholder="387 000-0000"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Sucursal (requerida) */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Sucursal *</label>
                <select
                  required value={form.sucursal_id} onChange={set('sucursal_id')}
                  className={inputCls}
                >
                  <option value="">— Seleccioná una sucursal</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fecha ingreso + Salario */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Fecha de ingreso</label>
                  <input
                    type="date" value={form.fecha_ingreso} onChange={set('fecha_ingreso')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Salario mensual ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs pointer-events-none">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.salario} onChange={set('salario')}
                      placeholder="0"
                      className={inputCls + ' pl-6'}
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
                  {loading ? 'Guardando…' : 'Crear Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
