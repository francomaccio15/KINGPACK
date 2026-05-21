'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoOperacion =
  | 'compra_mercaderia'
  | 'compra_gasto'
  | 'carga_social_laboral'
  | 'gasto_manual'
  | 'inversion_bien_uso'
  | 'anticipo_proveedor';

type TipoComprobante =
  | 'factura_a' | 'factura_b' | 'factura_c'
  | 'nota_debito_a' | 'nota_debito_b' | 'nota_debito_c'
  | 'nota_credito_a' | 'nota_credito_b' | 'nota_credito_c'
  | 'informal' | '';

interface LineItem {
  key: number;
  articulo_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  sucursal_imputacion_id: string;
}

interface ArticuloResult {
  id: string;
  nombre: string;
  codigo: string;
  costo_base: number;
  precio_madre: number;
}

interface Anticipo {
  id: string;
  monto: string;
  fecha: string;
  descripcion: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPOS_CON_PROVEEDOR: TipoOperacion[] = ['compra_mercaderia', 'compra_gasto', 'inversion_bien_uso', 'anticipo_proveedor'];
const TIPOS_CON_ITEMS: TipoOperacion[] = ['compra_mercaderia', 'compra_gasto'];
const TIPOS_CON_COMPROBANTE: TipoOperacion[] = ['compra_mercaderia', 'compra_gasto', 'inversion_bien_uso'];

function esFacturaEnBlanco(tc: TipoComprobante) {
  return tc !== '' && tc !== 'informal';
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-kp-gray" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NuevoEgresoPage() {
  const router = useRouter();

  // Catálogos
  const [sucursales, setSucursales] = useState<{ id: string; nombre: string }[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; razon_social: string; cuit: string | null }[]>([]);
  const [rubros, setRubros] = useState<{ id: string; nombre: string; subrubros: { id: string; nombre: string }[] }[]>([]);
  const [mediosPago, setMediosPago] = useState<{ id: string; nombre: string; requiere_cuenta: boolean }[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<{ id: string; nombre: string }[]>([]);

  // Anticipos del proveedor seleccionado
  const [anticiposDisponibles, setAnticipasDisponibles] = useState<Anticipo[]>([]);

  // Estado del formulario
  const [tipoOp, setTipoOp] = useState<TipoOperacion>('compra_mercaderia');
  const [tipoComp, setTipoComp] = useState<TipoComprobante>('factura_a');
  const [puntoVenta, setPuntoVenta] = useState('');
  const [nroComprobante, setNroComprobante] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [proveedorId, setProveedorId] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [subrubroId, setSubrubroId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const nextKey = useRef(0);

  // Montos fiscales
  const [netoGravado, setNetoGravado] = useState('');
  const [netoNoGravado, setNetoNoGravado] = useState('');
  const [iva21, setIva21] = useState('');
  const [iva105, setIva105] = useState('');
  const [percepcionesIb, setPercepcionesIb] = useState('');
  const [otrosImpuestos, setOtrosImpuestos] = useState('');
  const [totalComprobante, setTotalComprobante] = useState('');

  // Pago
  const [estadoPago, setEstadoPago] = useState<'pendiente' | 'pagado'>('pendiente');
  const [fechaVenc, setFechaVenc] = useState('');
  const [medioPagoId, setMedioPagoId] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [cheques, setCheques] = useState<{ banco: string; numero_cheque: string; fecha_vencimiento: string; importe: string }[]>([]);

  // Anticipo a vincular
  const [anticipoId, setAnticipoId] = useState('');
  const [vincularAnticipo, setVincularAnticipo] = useState(false);

  // Búsqueda de artículos
  const [artQ, setArtQ] = useState('');
  const [artResults, setArtResults] = useState<ArticuloResult[]>([]);
  const [artLoading, setArtLoading] = useState(false);
  const artDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado de guardado
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Cargar catálogos al montar ────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/sucursales`).then(r => r.json()),
      fetch(`${API}/api/proveedores?limit=500`).then(r => r.json()),
      fetch(`${API}/api/rubros-gastos`).then(r => r.json()),
      fetch(`${API}/api/ventas/medios-pago`).then(r => r.json()).catch(() => ({ medios: [] })),
      fetch(`${API}/api/cuentas-bancarias`).then(r => r.json()),
    ]).then(([suc, prov, rub, mp, cb]) => {
      const sArr = suc.sucursales ?? [];
      setSucursales(sArr);
      if (sArr.length > 0) setSucursalId(sArr[0].id);
      setProveedores(prov.proveedores ?? []);
      setRubros(rub.rubros ?? []);
      setMediosPago(mp.medios ?? mp.medios_pago ?? []);
      setCuentasBancarias(cb.cuentas ?? []);
    }).catch(() => {});
  }, []);

  // ── Cargar anticipos cuando cambia el proveedor ───────────────────────────
  useEffect(() => {
    setAnticipasDisponibles([]);
    setVincularAnticipo(false);
    setAnticipoId('');
    if (!proveedorId || tipoOp === 'anticipo_proveedor') return;
    fetch(`${API}/api/proveedores/${proveedorId}/anticipos`)
      .then(r => r.json())
      .then(d => setAnticipasDisponibles(d.anticipos ?? []))
      .catch(() => {});
  }, [proveedorId, tipoOp]);

  // ── Reset al cambiar tipo de operación ────────────────────────────────────
  useEffect(() => {
    setItems([]);
    setProveedorId('');
    setNetoGravado('');
    setNetoNoGravado('');
    setIva21('');
    setIva105('');
    setPercepcionesIb('');
    setOtrosImpuestos('');
    setTotalComprobante('');
    setSaveError(null);
    if (TIPOS_CON_COMPROBANTE.includes(tipoOp)) {
      setTipoComp('factura_a');
    } else {
      setTipoComp('');
    }
  }, [tipoOp]);

  // ── IVA automático para facturas en blanco ────────────────────────────────
  useEffect(() => {
    if (!esFacturaEnBlanco(tipoComp)) return;
    const ng = parseFloat(netoGravado) || 0;
    setIva21((ng * 0.21).toFixed(2));
  }, [netoGravado, tipoComp]);

  // ── Total calculado de ítems ──────────────────────────────────────────────
  const totalItems = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  // ── Diferencia total vs suma fiscal ──────────────────────────────────────
  const sumaFiscal = [netoGravado, netoNoGravado, iva21, iva105, percepcionesIb, otrosImpuestos]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalNum = parseFloat(totalComprobante) || 0;
  const difTotal = Math.abs(totalNum - sumaFiscal);
  const totalOk = !TIPOS_CON_COMPROBANTE.includes(tipoOp) || difTotal <= 0.02 || sumaFiscal === 0;

  // ── Búsqueda de artículos ─────────────────────────────────────────────────
  const searchArticulos = useCallback((q: string) => {
    if (artDebounce.current) clearTimeout(artDebounce.current);
    if (!q.trim()) { setArtResults([]); return; }
    artDebounce.current = setTimeout(async () => {
      setArtLoading(true);
      try {
        const res = await fetch(`${API}/api/articulos?q=${encodeURIComponent(q)}&limit=10`);
        const data = await res.json();
        setArtResults(data.articulos ?? []);
      } catch { setArtResults([]); }
      finally { setArtLoading(false); }
    }, 280);
  }, []);

  const addArticuloItem = (art: ArticuloResult) => {
    setItems(prev => {
      const existing = prev.find(i => i.articulo_id === art.id);
      if (existing) return prev.map(i => i.articulo_id === art.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        key: nextKey.current++,
        articulo_id: art.id,
        descripcion: art.nombre,
        cantidad: 1,
        precio_unitario: art.costo_base ?? 0,
        sucursal_imputacion_id: sucursalId,
      }];
    });
    setArtQ('');
    setArtResults([]);
  };

  const addLineaLibre = () => {
    setItems(prev => [...prev, {
      key: nextKey.current++,
      articulo_id: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      sucursal_imputacion_id: sucursalId,
    }]);
  };

  const updateItem = (key: number, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const removeItem = (key: number) => setItems(prev => prev.filter(i => i.key !== key));

  // ── Cheques ───────────────────────────────────────────────────────────────
  const addCheque = () => setCheques(p => [...p, { banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' }]);
  const updateCheque = (idx: number, f: string, v: string) => setCheques(p => p.map((c, i) => i === idx ? { ...c, [f]: v } : c));
  const removeCheque = (idx: number) => setCheques(p => p.filter((_, i) => i !== idx));

  const medioSeleccionado = mediosPago.find(m => m.id === medioPagoId);
  const esCheque = medioSeleccionado?.nombre?.toLowerCase().includes('cheque');

  // ── Validación y envío ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaveError(null);

    if (!sucursalId) return setSaveError('Seleccioná una sucursal');
    if (!descripcion.trim()) return setSaveError('Ingresá una descripción');
    if (!totalComprobante || parseFloat(totalComprobante) <= 0) return setSaveError('Ingresá el total del comprobante');
    if (TIPOS_CON_PROVEEDOR.includes(tipoOp) && !proveedorId) return setSaveError('Seleccioná un proveedor');
    if (TIPOS_CON_ITEMS.includes(tipoOp) && items.length === 0) return setSaveError('Agregá al menos un ítem');
    if (tipoOp === 'compra_mercaderia') {
      if (items.some(i => !i.articulo_id)) return setSaveError('Cada ítem de compra de mercadería requiere un artículo seleccionado');
    }
    if (esFacturaEnBlanco(tipoComp) && !netoGravado && !netoNoGravado) {
      return setSaveError('Las facturas en blanco requieren neto gravado o neto no gravado');
    }
    if (TIPOS_CON_COMPROBANTE.includes(tipoOp) && !totalOk) {
      return setSaveError(`El total (${ars.format(totalNum)}) no coincide con la suma de netos e impuestos (${ars.format(sumaFiscal)})`);
    }
    if (estadoPago === 'pagado' && !medioPagoId) return setSaveError('Seleccioná el medio de pago');

    const body: Record<string, unknown> = {
      tipo_operacion: tipoOp,
      tipo_comprobante: tipoComp || null,
      punto_venta: puntoVenta || null,
      numero_comprobante: nroComprobante || null,
      fecha_emision: fechaEmision,
      proveedor_id: proveedorId || null,
      sucursal_id: sucursalId,
      subrubro_gasto_id: subrubroId || null,
      descripcion: descripcion.trim(),
      neto_gravado: parseFloat(netoGravado) || 0,
      neto_no_gravado: parseFloat(netoNoGravado) || 0,
      iva_21: parseFloat(iva21) || 0,
      iva_105: parseFloat(iva105) || 0,
      percepciones_ib: parseFloat(percepcionesIb) || 0,
      otros_impuestos: parseFloat(otrosImpuestos) || 0,
      total: parseFloat(totalComprobante),
      estado_pago: estadoPago === 'pagado' ? 'pagado' : 'pendiente',
      fecha_vencimiento_pago: fechaVenc || null,
      anticipo_id: vincularAnticipo && anticipoId ? anticipoId : null,
      items: items.map(i => ({
        articulo_id: i.articulo_id || null,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        sucursal_imputacion_id: i.sucursal_imputacion_id || sucursalId,
      })),
    };

    if (estadoPago === 'pagado' && medioPagoId) {
      body.pago = {
        medio_pago_id: medioPagoId,
        monto: parseFloat(montoPago) || parseFloat(totalComprobante),
        cuenta_bancaria_id: cuentaBancariaId || null,
        cheques: esCheque ? cheques : [],
      };
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/egresos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Error al guardar'); return; }
      router.push('/gastos');
    } catch {
      setSaveError('Error de conexión con el servidor');
    } finally {
      setSaving(false);
    }
  };

  // ── Estilos reutilizables ─────────────────────────────────────────────────
  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';
  const sectionCls = 'rounded-xl border border-kp-border p-5 space-y-4';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Nuevo Egreso</h2>
        </div>
        <Link href="/gastos" className="text-sm text-kp-gray hover:text-kp-white transition-colors">
          ← Volver a Gastos
        </Link>
      </div>

      {/* ── Sección 1: Tipo de operación ─── */}
      <div className={sectionCls}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Tipo de operación</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([
            ['compra_mercaderia',    'Compra de Mercadería',    'Actualiza stock'],
            ['compra_gasto',         'Compra / Gasto',          'Con comprobante, sin stock'],
            ['carga_social_laboral', 'Carga Social y Laboral',  'Formulario 931, sueldos...'],
            ['gasto_manual',         'Gasto Manual',            'Sin comprobante comercial'],
            ['inversion_bien_uso',   'Inversión / Bien de Uso', 'Con factura'],
            ['anticipo_proveedor',   'Anticipo a Proveedor',    'Pago adelantado'],
          ] as [TipoOperacion, string, string][]).map(([val, label, hint]) => (
            <button
              key={val}
              type="button"
              onClick={() => setTipoOp(val)}
              className={[
                'text-left p-3 rounded-lg border transition-colors',
                tipoOp === val
                  ? 'border-kp-red bg-kp-red/10 text-kp-white'
                  : 'border-kp-border bg-kp-surface hover:border-kp-gray text-kp-gray hover:text-kp-white',
              ].join(' ')}
            >
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-kp-gray mt-0.5">{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Sección 2: Cabecera del comprobante ─── */}
      {TIPOS_CON_COMPROBANTE.includes(tipoOp) && (
        <div className={sectionCls}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Comprobante</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Tipo *</label>
              <select value={tipoComp} onChange={e => setTipoComp(e.target.value as TipoComprobante)} className={inputCls}>
                <option value="factura_a">Factura A</option>
                <option value="factura_b">Factura B</option>
                <option value="factura_c">Factura C</option>
                <option value="nota_debito_a">Nota Débito A</option>
                <option value="nota_debito_b">Nota Débito B</option>
                <option value="nota_debito_c">Nota Débito C</option>
                <option value="nota_credito_a">Nota Crédito A</option>
                <option value="nota_credito_b">Nota Crédito B</option>
                <option value="nota_credito_c">Nota Crédito C</option>
                <option value="informal">Comprobante Informal</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Punto de venta</label>
              <input
                type="text"
                placeholder="00001"
                value={puntoVenta}
                onChange={e => setPuntoVenta(e.target.value)}
                className={inputCls}
                maxLength={10}
              />
            </div>

            <div>
              <label className={labelCls}>Número *</label>
              <input
                type="text"
                placeholder="00000001"
                value={nroComprobante}
                onChange={e => setNroComprobante(e.target.value)}
                className={inputCls}
                maxLength={20}
              />
            </div>

            <div>
              <label className={labelCls}>Fecha de emisión *</label>
              <input
                type="date"
                value={fechaEmision}
                onChange={e => setFechaEmision(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Sección 3: Proveedor ─── */}
      {TIPOS_CON_PROVEEDOR.includes(tipoOp) && (
        <div className={sectionCls}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Proveedor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Proveedor *</label>
              <select
                value={proveedorId}
                onChange={e => setProveedorId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Seleccionar —</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.razon_social}{p.cuit ? ` (${p.cuit})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de comprobante informal sin campos fiscales */}
            {tipoComp === 'informal' && (
              <div className="flex items-center">
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Comprobante informal — sin campos de IVA
                </span>
              </div>
            )}
          </div>

          {/* Alerta de anticipo disponible */}
          {anticiposDisponibles.length > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/40 bg-blue-500/10">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-400">
                  Este proveedor tiene {anticiposDisponibles.length > 1
                    ? `${anticiposDisponibles.length} anticipos disponibles`
                    : 'un anticipo disponible'} (total:{' '}
                  {ars.format(anticiposDisponibles.reduce((s, a) => s + parseFloat(a.monto), 0))})
                </p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vincularAnticipo}
                    onChange={e => setVincularAnticipo(e.target.checked)}
                    className="rounded border-kp-border"
                  />
                  <span className="text-xs text-blue-400">Vincular anticipo a esta factura</span>
                </label>
                {vincularAnticipo && anticiposDisponibles.length > 1 && (
                  <select
                    value={anticipoId}
                    onChange={e => setAnticipoId(e.target.value)}
                    className={`${inputCls} mt-2 w-auto`}
                  >
                    <option value="">— Seleccionar anticipo —</option>
                    {anticiposDisponibles.map(a => (
                      <option key={a.id} value={a.id}>
                        {new Date(a.fecha).toLocaleDateString('es-AR')} — {ars.format(parseFloat(a.monto))}
                        {a.descripcion ? ` — ${a.descripcion}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {vincularAnticipo && anticiposDisponibles.length === 1 && (
                  <input type="hidden" value={anticiposDisponibles[0].id} ref={el => { if (el) setAnticipoId(anticiposDisponibles[0].id); }} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sección 4: Imputación y descripción ─── */}
      <div className={sectionCls}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Imputación</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Sucursal *</label>
            <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className={inputCls}>
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Rubro / Subrubro</label>
            <select value={subrubroId} onChange={e => setSubrubroId(e.target.value)} className={inputCls}>
              <option value="">— Sin clasificar —</option>
              {rubros.map(r => (
                <optgroup key={r.id} label={r.nombre}>
                  {r.subrubros.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {!TIPOS_CON_COMPROBANTE.includes(tipoOp) && (
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Descripción *</label>
          <input
            type="text"
            placeholder={tipoOp === 'carga_social_laboral' ? 'Ej: Formulario 931 Mayo 2025' : 'Descripción del egreso'}
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Sección 5: Ítems (compra_mercaderia y compra_gasto) ─── */}
      {TIPOS_CON_ITEMS.includes(tipoOp) && (
        <div className={sectionCls}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
            Detalle de ítems
          </h3>

          {/* Buscador de artículos para compra_mercaderia */}
          {tipoOp === 'compra_mercaderia' && (
            <div>
              <label className={labelCls}>Agregar artículo</label>
              <div className="relative">
                <input
                  type="search"
                  placeholder="Buscar por nombre o código…"
                  value={artQ}
                  onChange={e => { setArtQ(e.target.value); searchArticulos(e.target.value); }}
                  className={inputCls}
                />
                {artLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner /></span>
                )}
                {artResults.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-kp-surface2 border border-kp-border rounded-lg shadow-xl overflow-hidden">
                    {artResults.map(a => (
                      <li key={a.id}>
                        <button type="button" onClick={() => addArticuloItem(a)}
                          className="w-full text-left px-4 py-2.5 hover:bg-kp-red/10 transition-colors flex items-center justify-between gap-3">
                          <div>
                            <span className="text-sm font-medium text-kp-white">{a.nombre}</span>
                            <span className="ml-2 text-xs text-kp-gray font-mono">{a.codigo}</span>
                          </div>
                          <span className="text-xs text-kp-gray-lt tabular-nums">{ars.format(a.costo_base)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Botón agregar línea libre para compra_gasto */}
          {tipoOp === 'compra_gasto' && (
            <button type="button" onClick={addLineaLibre}
              className="flex items-center gap-2 text-sm text-kp-gray hover:text-kp-white transition-colors px-3 py-2 rounded-lg border border-kp-border hover:border-kp-gray">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Agregar línea
            </button>
          )}

          {items.length > 0 && (
            <div className="rounded-xl border border-kp-border overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-kp-surface2 border-b border-kp-border">
                    <th className="text-left px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold">
                      {tipoOp === 'compra_mercaderia' ? 'Artículo' : 'Descripción'}
                    </th>
                    <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-20">Cant.</th>
                    <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-32">P. Unitario</th>
                    <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-28">Neto línea</th>
                    <th className="text-left px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-32">Sucursal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-kp-border">
                  {items.map((item) => (
                    <tr key={item.key} className="bg-kp-surface">
                      <td className="px-3 py-2">
                        {tipoOp === 'compra_mercaderia'
                          ? <div className="text-sm font-medium text-kp-white">{item.descripcion}</div>
                          : <input
                              type="text"
                              placeholder="Descripción del ítem"
                              value={item.descripcion}
                              onChange={e => updateItem(item.key, 'descripcion', e.target.value)}
                              className="w-full bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                            />
                        }
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="0.001" step="1"
                          value={item.cantidad}
                          onChange={e => updateItem(item.key, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="0" step="0.01"
                          value={item.precio_unitario}
                          onChange={e => updateItem(item.key, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-sm text-kp-white font-semibold">
                        {ars.format(item.cantidad * item.precio_unitario)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={item.sucursal_imputacion_id}
                          onChange={e => updateItem(item.key, 'sucursal_imputacion_id', e.target.value)}
                          className="w-full bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                        >
                          {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button type="button" onClick={() => removeItem(item.key)}
                          className="text-kp-gray hover:text-kp-red transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-kp-surface2 border-t border-kp-border">
                    <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold uppercase tracking-widest text-kp-gray">
                      Subtotal ítems
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-kp-white">
                      {ars.format(totalItems)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sección 6: Impuestos y totales ─── */}
      <div className={sectionCls}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Montos y totales</h3>

        {/* Campos fiscales solo para facturas en blanco */}
        {TIPOS_CON_COMPROBANTE.includes(tipoOp) && esFacturaEnBlanco(tipoComp) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Neto gravado *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={netoGravado}
                onChange={e => setNetoGravado(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Neto no gravado / exento</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={netoNoGravado}
                onChange={e => setNetoNoGravado(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IVA 21% (auto)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={iva21}
                onChange={e => setIva21(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IVA 10.5%</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={iva105}
                onChange={e => setIva105(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Percepciones IIBB</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={percepcionesIb}
                onChange={e => setPercepcionesIb(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Otros impuestos</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={otrosImpuestos}
                onChange={e => setOtrosImpuestos(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        {/* Total del comprobante — siempre visible */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`${labelCls} text-kp-white`}>Total del comprobante *</label>
            <input
              type="number" min="0.01" step="0.01" placeholder="0.00"
              value={totalComprobante}
              onChange={e => setTotalComprobante(e.target.value)}
              className={`${inputCls} text-lg font-bold ${TIPOS_CON_COMPROBANTE.includes(tipoOp) && !totalOk && totalNum > 0 && sumaFiscal > 0 ? 'border-kp-red' : ''}`}
            />
          </div>

          {/* Indicador de validación de total */}
          {TIPOS_CON_COMPROBANTE.includes(tipoOp) && esFacturaEnBlanco(tipoComp) && totalNum > 0 && sumaFiscal > 0 && (
            <div className="flex items-end pb-1">
              {totalOk
                ? <span className="flex items-center gap-2 text-sm text-green-400">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Total verificado
                  </span>
                : <span className="flex items-center gap-2 text-sm text-kp-red">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Diferencia: {ars.format(Math.abs(difTotal))}
                  </span>
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Sección 7: Forma de pago ─── */}
      <div className={sectionCls}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Forma de pago</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Estado de pago</label>
            <select value={estadoPago} onChange={e => setEstadoPago(e.target.value as 'pendiente' | 'pagado')} className={inputCls}>
              <option value="pendiente">Queda pendiente de pago</option>
              <option value="pagado">Registrar pago ahora</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Fecha de vencimiento</label>
            <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} className={inputCls} />
          </div>
        </div>

        {estadoPago === 'pagado' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-kp-border">
            <div>
              <label className={labelCls}>Medio de pago *</label>
              <select value={medioPagoId} onChange={e => setMedioPagoId(e.target.value)} className={inputCls}>
                <option value="">— Seleccionar —</option>
                {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Monto pagado</label>
              <input type="number" min="0.01" step="0.01" placeholder={totalComprobante || '0.00'}
                value={montoPago} onChange={e => setMontoPago(e.target.value)} className={inputCls} />
            </div>

            {medioSeleccionado?.requiere_cuenta && (
              <div>
                <label className={labelCls}>Cuenta bancaria</label>
                <select value={cuentaBancariaId} onChange={e => setCuentaBancariaId(e.target.value)} className={inputCls}>
                  <option value="">— Seleccionar —</option>
                  {cuentasBancarias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Cheques */}
        {estadoPago === 'pagado' && esCheque && (
          <div className="space-y-3 pt-2 border-t border-kp-border">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Cheques</p>
              <button type="button" onClick={addCheque}
                className="flex items-center gap-1 text-xs text-kp-gray hover:text-kp-white transition-colors px-2 py-1 rounded border border-kp-border hover:border-kp-gray">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar cheque
              </button>
            </div>
            {cheques.map((ch, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className={labelCls}>Banco</label>
                  <input type="text" placeholder="Banco" value={ch.banco}
                    onChange={e => updateCheque(i, 'banco', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nº Cheque</label>
                  <input type="text" placeholder="00000000" value={ch.numero_cheque}
                    onChange={e => updateCheque(i, 'numero_cheque', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vencimiento</label>
                  <input type="date" value={ch.fecha_vencimiento}
                    onChange={e => updateCheque(i, 'fecha_vencimiento', e.target.value)} className={inputCls} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={labelCls}>Importe</label>
                    <input type="number" min="0.01" step="0.01" placeholder="0.00" value={ch.importe}
                      onChange={e => updateCheque(i, 'importe', e.target.value)} className={inputCls} />
                  </div>
                  <button type="button" onClick={() => removeCheque(i)}
                    className="self-end text-kp-gray hover:text-kp-red transition-colors pb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {cheques.length > 0 && (
              <div className="flex justify-end text-sm">
                <span className="text-kp-gray mr-2">Total cheques:</span>
                <span className={`tabular-nums font-bold ${Math.abs(cheques.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0) - (parseFloat(montoPago) || parseFloat(totalComprobante) || 0)) > 0.01 ? 'text-kp-red' : 'text-green-400'}`}>
                  {ars.format(cheques.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0))}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error y botón de confirmación ─── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          {saveError && (
            <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-3">
              {saveError}
            </p>
          )}
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Link href="/gastos"
            className="px-6 py-2.5 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
            Cancelar
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <><Spinner /> Guardando…</> : 'Confirmar Egreso'}
          </button>
        </div>
      </div>

    </div>
  );
}
