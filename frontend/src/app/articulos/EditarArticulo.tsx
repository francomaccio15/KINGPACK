'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Categoria = { id: string; nombre: string; margen_default: string };
type Alicuota  = { id: string; porcentaje: string; descripcion: string };

type Articulo = {
  id: string;
  codigo: string;
  nombre: string;
  precio_madre: string;
  costo_base?: string;
  costo_flete?: string;
  margen_aplicado?: string | null;
  categoria_id: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
});

export default function EditarArticulo({
  articulo,
  categorias,
  alicuotas,
}: {
  articulo: Articulo;
  categorias: Categoria[];
  alicuotas: Alicuota[];
}) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    nombre:          articulo.nombre,
    categoria_id:    articulo.categoria_id,
    costo_base:      articulo.costo_base     ?? '',
    costo_flete:     articulo.costo_flete    ?? '',
    margen_aplicado: articulo.margen_aplicado ?? '',
  });

  const catActiva  = categorias.find(c => c.id === form.categoria_id);
  const margenReal = form.margen_aplicado !== '' && form.margen_aplicado !== null
    ? parseFloat(String(form.margen_aplicado))
    : parseFloat(catActiva?.margen_default ?? '0');
  const costo      = parseFloat(form.costo_base)  || 0;
  const flete      = parseFloat(form.costo_flete) || 0;

  // precio_madre calculado igual que el trigger del backend
  // (sin IVA visible aquí — lo muestra como referencia el precio actual)
  const precioRef  = parseFloat(articulo.precio_madre) || 0;

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const cerrar = () => { setOpen(false); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/articulos/${articulo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:          form.nombre.trim(),
          categoria_id:    form.categoria_id,
          costo_base:      parseFloat(form.costo_base)  || 0,
          costo_flete:     parseFloat(form.costo_flete) || 0,
          margen_aplicado: form.margen_aplicado !== '' ? parseFloat(String(form.margen_aplicado)) : null,
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
      {/* ── Botón por fila ── */}
      <button
        onClick={() => setOpen(true)}
        title="Editar precio"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg
          text-kp-gray hover:text-kp-white hover:bg-kp-surface2 border border-transparent
          hover:border-kp-border"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-md bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wide">Editar artículo</h3>
                  <p className="text-[11px] text-kp-gray font-mono mt-0.5">{articulo.codigo}</p>
                </div>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Nombre */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Nombre</label>
                <input
                  required value={form.nombre} onChange={set('nombre')}
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    focus:outline-none focus:border-kp-red transition-colors"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Categoría</label>
                <select
                  value={form.categoria_id} onChange={set('categoria_id')}
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    focus:outline-none focus:border-kp-red transition-colors"
                >
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Costo + Flete + Margen */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Costo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.costo_base} onChange={set('costo_base')}
                      placeholder="0.00"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Flete</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.costo_flete} onChange={set('costo_flete')}
                      placeholder="0.00"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">
                    Margen %
                    {(form.margen_aplicado === '' || form.margen_aplicado === null) && catActiva?.margen_default && (
                      <span className="ml-1 text-kp-gray normal-case tracking-normal">
                        ({catActiva.margen_default}%)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="999" step="0.1"
                      value={form.margen_aplicado ?? ''} onChange={set('margen_aplicado')}
                      placeholder={catActiva?.margen_default ?? '—'}
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 pr-6 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
                  </div>
                </div>
              </div>

              {/* Precio actual */}
              <div className="flex items-center justify-between rounded-xl bg-kp-surface2 border border-kp-border px-5 py-3">
                <span className="text-xs text-kp-gray uppercase tracking-widest">Precio actual</span>
                <span className="text-xl font-bold tabular-nums text-kp-white">
                  {ars.format(precioRef)}
                </span>
              </div>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm
                    hover:text-kp-white hover:border-kp-gray transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark disabled:opacity-50
                    text-white text-sm font-semibold transition-colors"
                >
                  {loading ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
