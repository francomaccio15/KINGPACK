'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Categoria = { id: string; nombre: string; margen_default: string };
type Alicuota  = { id: string; porcentaje: string; descripcion: string };

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2,
});

const EMPTY_FORM = {
  codigo: '', nombre: '', categoria_id: '', alicuota_iva_id: '',
  costo_base: '', costo_flete: '', margen_aplicado: '',
};

const EMPTY_CAT = { nombre: '', margen_default: '' };

export default function NuevoArticulo({
  categorias: categoriasInit,
  alicuotas,
}: {
  categorias: Categoria[];
  alicuotas: Alicuota[];
}) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState(EMPTY_FORM);
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasInit);

  // Panel de nueva categoría
  const [showCat, setShowCat]     = useState(false);
  const [catForm, setCatForm]     = useState(EMPTY_CAT);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError]   = useState('');

  // Pre-seleccionar IVA 21% por defecto
  useEffect(() => {
    const iva21 = alicuotas.find(a => parseFloat(a.porcentaje) === 21);
    setForm(f => ({
      ...f,
      categoria_id:    categoriasInit[0]?.id ?? '',
      alicuota_iva_id: iva21?.id ?? alicuotas[0]?.id ?? '',
    }));
  }, [categoriasInit, alicuotas]);

  const catActiva  = categorias.find(c => c.id === form.categoria_id);
  const ivaActiva  = alicuotas.find(a => a.id === form.alicuota_iva_id);
  const margenReal = form.margen_aplicado !== ''
    ? parseFloat(form.margen_aplicado)
    : parseFloat(catActiva?.margen_default ?? '0');
  const ivaReal    = parseFloat(ivaActiva?.porcentaje ?? '0');
  const costo      = parseFloat(form.costo_base)  || 0;
  const flete      = parseFloat(form.costo_flete) || 0;
  const precioCalc = (costo + flete) * (1 + margenReal / 100) * (1 + ivaReal / 100);

  const set = (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const cerrar = () => {
    setOpen(false); setError('');
    setShowCat(false); setCatForm(EMPTY_CAT); setCatError('');
  };

  // ── Crear categoría ────────────────────────────────────────────────────────
  const handleCrearCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    setCatLoading(true);
    try {
      const res = await fetch(`${API}/api/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:        catForm.nombre.trim(),
          margen_default: catForm.margen_default !== '' ? parseFloat(catForm.margen_default) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al crear categoría');
      const nueva: Categoria = data.categoria;
      setCategorias(prev => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm(f => ({ ...f, categoria_id: nueva.id }));
      setShowCat(false);
      setCatForm(EMPTY_CAT);
    } catch (err: any) {
      setCatError(err.message);
    } finally {
      setCatLoading(false);
    }
  };

  // ── Crear artículo ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/articulos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo:          form.codigo.trim(),
          nombre:          form.nombre.trim(),
          categoria_id:    form.categoria_id,
          alicuota_iva_id: form.alicuota_iva_id,
          costo_base:      parseFloat(form.costo_base)  || 0,
          costo_flete:     parseFloat(form.costo_flete) || 0,
          margen_aplicado: form.margen_aplicado !== '' ? parseFloat(form.margen_aplicado) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      setForm(f => ({ ...EMPTY_FORM, categoria_id: f.categoria_id, alicuota_iva_id: f.alicuota_iva_id }));
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
      {/* ── Botón principal ── */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
          bg-kp-red hover:bg-kp-red-dark transition-colors text-white text-sm font-semibold
          shadow shadow-kp-red/30"
      >
        <span className="text-lg leading-none">+</span> Nuevo Artículo
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-lg bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Nuevo Artículo</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Código + Nombre */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Código *</label>
                  <input
                    required value={form.codigo} onChange={set('codigo')}
                    placeholder="ej: DES-001"
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Nombre *</label>
                  <input
                    required value={form.nombre} onChange={set('nombre')}
                    placeholder="Descripción del producto"
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                  />
                </div>
              </div>

              {/* Categoría + IVA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-kp-gray uppercase tracking-widest">Categoría *</label>
                    <button
                      type="button"
                      onClick={() => { setShowCat(v => !v); setCatError(''); }}
                      className="text-[10px] text-kp-red hover:text-white transition-colors font-semibold uppercase tracking-wide"
                    >
                      {showCat ? '— Cancelar' : '+ Nueva'}
                    </button>
                  </div>
                  <select
                    required value={form.categoria_id} onChange={set('categoria_id')}
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      focus:outline-none focus:border-kp-red transition-colors"
                  >
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">IVA *</label>
                  <select
                    required value={form.alicuota_iva_id} onChange={set('alicuota_iva_id')}
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                      focus:outline-none focus:border-kp-red transition-colors"
                  >
                    {alicuotas.map(a => (
                      <option key={a.id} value={a.id}>{a.descripcion} ({a.porcentaje}%)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Panel nueva categoría (inline) */}
              {showCat && (
                <div className="rounded-xl border border-kp-red/30 bg-kp-surface2 p-4 space-y-3">
                  <p className="text-xs text-kp-red font-semibold uppercase tracking-widest">Nueva categoría</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-kp-gray mb-1">Nombre *</label>
                      <input
                        value={catForm.nombre}
                        onChange={e => setCatForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="ej: Vasos descartables"
                        className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                          placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-kp-gray mb-1">Margen %</label>
                      <div className="relative">
                        <input
                          type="number" min="0" max="999" step="0.1"
                          value={catForm.margen_default}
                          onChange={e => setCatForm(f => ({ ...f, margen_default: e.target.value }))}
                          placeholder="0"
                          className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 pr-6 py-2 text-sm text-kp-white
                            placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
                      </div>
                    </div>
                  </div>
                  {catError && (
                    <p className="text-xs text-kp-red">{catError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleCrearCategoria}
                    disabled={catLoading || !catForm.nombre.trim()}
                    className="w-full py-2 rounded-lg bg-kp-surface border border-kp-red/50 text-kp-red text-sm font-semibold
                      hover:bg-kp-red hover:text-white disabled:opacity-40 transition-colors"
                  >
                    {catLoading ? 'Creando…' : 'Crear categoría'}
                  </button>
                </div>
              )}

              {/* Costo + Flete + Margen */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Costo *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                    <input
                      required type="number" min="0" step="0.01"
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
                    {form.margen_aplicado === '' && catActiva?.margen_default && (
                      <span className="ml-1 text-kp-gray normal-case tracking-normal">
                        (cat: {catActiva.margen_default}%)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="999" step="0.1"
                      value={form.margen_aplicado} onChange={set('margen_aplicado')}
                      placeholder={catActiva?.margen_default ?? '—'}
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 pr-6 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
                  </div>
                </div>
              </div>

              {/* Preview precio */}
              <div className="flex items-center justify-between rounded-xl bg-kp-surface2 border border-kp-border px-5 py-3">
                <span className="text-xs text-kp-gray uppercase tracking-widest">Precio de venta estimado</span>
                <span className={`text-xl font-bold tabular-nums ${precioCalc > 0 ? 'text-kp-white' : 'text-kp-gray'}`}>
                  {precioCalc > 0 ? ars.format(precioCalc) : '—'}
                </span>
              </div>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              {/* Acciones */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white
                    hover:border-kp-gray transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark disabled:opacity-50
                    text-white text-sm font-semibold transition-colors"
                >
                  {loading ? 'Guardando…' : 'Guardar Artículo'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
