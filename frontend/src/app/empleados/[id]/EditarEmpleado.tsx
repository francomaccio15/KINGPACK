'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Empleado = {
  id: string; nombre: string; dni: string | null; cargo: string | null;
  email: string | null; telefono: string | null; fecha_ingreso: string | null;
  salario: string | null; activo: boolean; sucursal_id: string;
};
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

const inputCls = `w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
  placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors`;

export default function EditarEmpleado({
  empleado, sucursales, esAdmin,
}: {
  empleado: Empleado;
  sucursales: Sucursal[];
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [open,       setOpen]       = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const fechaIngreso = empleado.fecha_ingreso
    ? empleado.fecha_ingreso.split('T')[0]
    : '';

  const [form, setForm] = useState({
    nombre:        empleado.nombre,
    dni:           empleado.dni          ?? '',
    cargo:         empleado.cargo        ?? '',
    email:         empleado.email        ?? '',
    telefono:      empleado.telefono     ?? '',
    fecha_ingreso: fechaIngreso,
    salario:       empleado.salario      ?? '',
    sucursal_id:   empleado.sucursal_id  ?? '',
    activo:        empleado.activo,
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const cerrar = () => { setOpen(false); setError(''); setConfirmDel(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/empleados/${empleado.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre:        form.nombre.trim(),
          dni:           form.dni.trim()          || null,
          cargo:         form.cargo.trim()        || null,
          email:         form.email.trim()        || null,
          telefono:      form.telefono.trim()     || null,
          fecha_ingreso: form.fecha_ingreso        || null,
          salario:       form.salario             ? parseFloat(form.salario) : null,
          sucursal_id:   form.sucursal_id          || null,
          activo:        form.activo,
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

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/empleados/${empleado.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar');
      router.push('/empleados');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border
          text-kp-gray hover:text-kp-white hover:border-kp-gray text-sm transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
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
                <h3 className="font-bold text-base uppercase tracking-wide">Editar Empleado</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

              {/* Nombre */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Nombre completo *</label>
                <input required value={form.nombre} onChange={set('nombre')} className={inputCls} />
              </div>

              {/* DNI + Cargo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">DNI</label>
                  <input value={form.dni} onChange={set('dni')} placeholder="00.000.000" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Cargo</label>
                  <input value={form.cargo} onChange={set('cargo')} placeholder="Ej: Vendedor" className={inputCls} />
                </div>
              </div>

              {/* Email + Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Email</label>
                  <input type="email" value={form.email} onChange={set('email')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Teléfono</label>
                  <input value={form.telefono} onChange={set('telefono')} className={inputCls} />
                </div>
              </div>

              {/* Sucursal */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Sucursal *</label>
                <select required value={form.sucursal_id} onChange={set('sucursal_id')} className={inputCls}>
                  <option value="">— Seleccioná una sucursal</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fecha + Salario (salario solo visible para admin) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Fecha de ingreso</label>
                  <input type="date" value={form.fecha_ingreso} onChange={set('fecha_ingreso')} className={inputCls} />
                </div>
                {esAdmin && (
                  <div>
                    <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Salario ($)</label>
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
                )}
              </div>

              {/* Estado activo */}
              <div className="flex items-center gap-3 py-1">
                <label className="text-xs text-kp-gray uppercase tracking-widest">Estado</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                  className={[
                    'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border-2 transition-colors',
                    form.activo ? 'bg-green-500 border-green-600' : 'bg-kp-surface2 border-kp-border',
                  ].join(' ')}
                >
                  <span className={[
                    'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                    form.activo ? 'translate-x-4' : 'translate-x-0.5',
                  ].join(' ')} />
                </button>
                <span className={`text-xs font-medium ${form.activo ? 'text-green-400' : 'text-kp-gray'}`}>
                  {form.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {loading ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>

              {/* Zona de peligro — solo admin */}
              {esAdmin && (
                <div className="pt-2 border-t border-kp-border">
                  {!confirmDel ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDel(true)}
                      className="text-xs text-rose-500 hover:text-rose-400 transition-colors"
                    >
                      Eliminar empleado…
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-rose-400 flex-1">¿Confirmar eliminación? Esta acción no se puede deshacer.</p>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                        className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
                      >
                        {loading ? '…' : 'Sí, eliminar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDel(false)}
                        className="text-xs text-kp-gray hover:text-kp-white transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
