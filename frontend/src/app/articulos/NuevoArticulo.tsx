'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

type Categoria = { id: string; nombre: string; margen_default: string };
type Alicuota  = { id: string; porcentaje: string; descripcion: string };

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

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
  const [codigoAuto, setCodigoAuto] = useState(true); // el código fue autogenerado (no editado a mano)

  // Precio de venta editable. Al cambiarlo se recalcula el margen (costo y flete
  // quedan fijos), igual que en Editar Artículo.
  const [precioInput, setPrecioInput] = useState('');

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

  // Autogenera el siguiente código correlativo (solo número) desde el backend.
  const generarCodigo = async () => {
    try {
      const res  = await apiFetch(`/api/articulos/next-codigo`);
      const data = await res.json();
      if (res.ok && data.codigo) {
        setForm(f => ({ ...f, codigo: data.codigo }));
        setCodigoAuto(true);
      }
    } catch { /* silencioso: siempre se puede escribir a mano */ }
  };

  // Al abrir el formulario, traer el próximo código.
  useEffect(() => {
    if (open) generarCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const catActiva  = categorias.find(c => c.id === form.categoria_id);
  const ivaActiva  = alicuotas.find(a => a.id === form.alicuota_iva_id);
  const margenReal = form.margen_aplicado !== ''
    ? parseFloat(form.margen_aplicado)
    : parseFloat(catActiva?.margen_default ?? '0');
  const ivaReal    = parseFloat(ivaActiva?.porcentaje ?? '0');
  const costo      = parseFloat(form.costo_base)  || 0;
  const flete      = parseFloat(form.costo_flete) || 0;

  // Costo con flete (neto, sin IVA) y ganancia por unidad según el precio cargado.
  const costoConFlete = costo * (1 + flete / 100);
  const precioNum     = parseFloat(precioInput) || 0;
  const gananciaUnit  = precioNum > 0 ? precioNum / (1 + ivaReal / 100) - costoConFlete : 0;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  // precio = costo × (1+flete%) × (1+iva%) × (1+margen%), redondeado a entero (igual que el backend)
  const precioDesde = (c: number, fl: number, m: number, iva: number) => {
    const b = c * (1 + fl / 100) * (1 + iva / 100);
    return b > 0 ? Math.round(b * (1 + m / 100)) : 0;
  };
  // margen implícito en un precio de venta dado (costo, flete e iva fijos)
  const margenDesde = (c: number, fl: number, p: number, iva: number) => {
    const b = c * (1 + fl / 100) * (1 + iva / 100);
    return b > 0 ? round2((p / b - 1) * 100) : 0;
  };

  const set = (k: keyof typeof EMPTY_FORM) =>
    (e: { target: { value: string } }) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  // ── Vínculo bidireccional precio ↔ margen (costo, flete e iva ajustan el precio) ──
  const onCosto = (e: { target: { value: string } }) => {
    const v = e.target.value;
    setForm(f => ({ ...f, costo_base: v }));
    setPrecioInput(String(precioDesde(parseFloat(v) || 0, flete, margenReal, ivaReal)));
  };
  const onFlete = (e: { target: { value: string } }) => {
    const v = e.target.value;
    setForm(f => ({ ...f, costo_flete: v }));
    setPrecioInput(String(precioDesde(costo, parseFloat(v) || 0, margenReal, ivaReal)));
  };
  const onMargen = (e: { target: { value: string } }) => {
    const v = e.target.value;
    setForm(f => ({ ...f, margen_aplicado: v }));
    const m = v !== '' ? (parseFloat(v) || 0) : (parseFloat(catActiva?.margen_default ?? '0') || 0);
    setPrecioInput(String(precioDesde(costo, flete, m, ivaReal)));
  };
  const onPrecio = (e: { target: { value: string } }) => {
    const v = e.target.value;
    setPrecioInput(v);
    const m = margenDesde(costo, flete, parseFloat(v) || 0, ivaReal);
    setForm(f => ({ ...f, margen_aplicado: String(m) }));
  };
  const onCategoria = (e: { target: { value: string } }) => {
    const v = e.target.value;
    setForm(f => ({ ...f, categoria_id: v }));
    if (form.margen_aplicado === '') {
      const cat = categorias.find(c => c.id === v);
      setPrecioInput(String(precioDesde(costo, flete, parseFloat(cat?.margen_default ?? '0') || 0, ivaReal)));
    }
  };
  const onIva = (e: { target: { value: string } }) => {
    const v = e.target.value;
    setForm(f => ({ ...f, alicuota_iva_id: v }));
    const nuevaIva = parseFloat(alicuotas.find(a => a.id === v)?.porcentaje ?? '0') || 0;
    setPrecioInput(String(precioDesde(costo, flete, margenReal, nuevaIva)));
  };

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
      const res = await apiFetch(`/api/categorias`, {
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
      const res = await apiFetch(`/api/articulos`, {
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
      setPrecioInput('');
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
                    required value={form.codigo}
                    onChange={e => { setForm(f => ({ ...f, codigo: e.target.value })); setCodigoAuto(false); }}
                    placeholder="ej: 001"
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
                    required value={form.categoria_id}
                    onChange={e => { onCategoria(e); if (codigoAuto) generarCodigo(); }}
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
                    required value={form.alicuota_iva_id} onChange={onIva}
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
                        <NumericInput
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
                    <NumericInput
                      required
                      value={form.costo_base} onChange={onCosto}
                      placeholder="0.00"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Flete %</label>
                  <div className="relative">
                    <NumericInput
                      value={form.costo_flete} onChange={onFlete}
                      placeholder="0.0"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 pr-6 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
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
                    <NumericInput
                      value={form.margen_aplicado} onChange={onMargen}
                      placeholder={catActiva?.margen_default ?? '—'}
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 pr-6 py-2 text-sm text-kp-white
                        placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
                  </div>
                </div>
              </div>

              {/* Precio de venta — editable. Al cambiarlo se ajusta el margen
                  (el costo y el flete no se modifican). */}
              <div className="rounded-xl bg-kp-surface2 border border-kp-border px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-kp-gray uppercase tracking-widest">Precio de venta final</span>
                    <span className="block text-[10px] text-kp-gray mt-0.5">
                      IVA {ivaReal.toFixed(0)}% incluido · editable
                    </span>
                  </div>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-sm">$</span>
                    <NumericInput
                      value={precioInput} onChange={onPrecio}
                      placeholder="0"
                      className="w-full bg-kp-surface border border-kp-border rounded-lg pl-7 pr-3 py-2
                        text-right text-xl font-bold tabular-nums text-kp-white
                        focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                </div>
                {costo > 0 && (
                  <div className="flex items-center justify-end gap-4 mt-2 text-[11px] text-kp-gray">
                    <span>
                      Margen:{' '}
                      <span className="font-semibold text-kp-white tabular-nums">
                        {isNaN(margenReal) ? '—' : `${round2(margenReal)}%`}
                      </span>
                    </span>
                    <span>
                      Ganancia x u.:{' '}
                      <span className={`font-semibold tabular-nums ${gananciaUnit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ars.format(gananciaUnit)}
                      </span>
                    </span>
                  </div>
                )}
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
