'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NumericInput from '@/components/NumericInput';

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
  descuento_pct: number;
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
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPOS_CON_PROVEEDOR: TipoOperacion[] = ['compra_mercaderia', 'inversion_bien_uso', 'anticipo_proveedor'];
const TIPOS_CON_ITEMS: TipoOperacion[] = ['compra_mercaderia'];
const TIPOS_CON_COMPROBANTE: TipoOperacion[] = ['compra_mercaderia', 'inversion_bien_uso'];

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

  // Bonificaciones / descuento extra en cascada sobre el subtotal de ítems
  const [bonificaciones, setBonificaciones] = useState<{ pct: string }[]>([]);

  // Montos fiscales
  const [netoGravado, setNetoGravado] = useState('');
  const [netoNoGravado, setNetoNoGravado] = useState('');
  const [iva21, setIva21] = useState('');
  const [iva105, setIva105] = useState('');
  const [percepcionesIb, setPercepcionesIb] = useState('');
  const [otrosImpuestos, setOtrosImpuestos] = useState('');
  const [totalComprobante, setTotalComprobante] = useState('');

  // Flete como porcentaje del total del comprobante. Se registra como egreso
  // aparte (subrubro "Transporte de carga") por el monto en pesos calculado.
  const [fletePct, setFletePct] = useState('');

  // Pago (uno o varios medios: pago dividido)
  const [estadoPago, setEstadoPago] = useState<'pendiente' | 'pagado'>('pendiente');
  const [fechaVenc, setFechaVenc] = useState('');
  const [pagoMedios, setPagoMedios] = useState<{ medio_pago_id: string; monto: string; cuenta_bancaria_id: string }[]>([]);
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
      apiFetch(`/api/sucursales`).then(r => r.json()),
      apiFetch(`/api/proveedores?limit=500`).then(r => r.json()),
      apiFetch(`/api/rubros-gastos`).then(r => r.json()),
      apiFetch(`/api/ventas/medios-pago`).then(r => r.json()).catch(() => ({ medios: [] })),
      apiFetch(`/api/cuentas-bancarias`).then(r => r.json()),
    ]).then(([suc, prov, rub, mp, cb]) => {
      const sArr = suc.sucursales ?? [];
      setSucursales(sArr);
      // Sucursal por defecto: Laprida (si existe); si no, la primera.
      const laprida = sArr.find((s: { nombre: string }) => /laprida/i.test(s.nombre));
      if (sArr.length > 0) setSucursalId((laprida ?? sArr[0]).id);
      setProveedores(prov.proveedores ?? []);
      setRubros(rub.rubros ?? []);
      const mediosArr = mp.medios ?? mp.medios_pago ?? [];
      setMediosPago(mediosArr);
      if (mediosArr.length > 0) setPagoMedios([{ medio_pago_id: mediosArr[0].id, monto: '', cuenta_bancaria_id: '' }]);
      setCuentasBancarias(cb.cuentas ?? []);
    }).catch(() => {});
  }, []);

  // ── Cargar anticipos cuando cambia el proveedor ───────────────────────────
  useEffect(() => {
    setAnticipasDisponibles([]);
    setVincularAnticipo(false);
    setAnticipoId('');
    if (!proveedorId || tipoOp === 'anticipo_proveedor') return;
    apiFetch(`/api/proveedores/${proveedorId}/anticipos`)
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
    setFletePct('');
    setSaveError(null);
    if (TIPOS_CON_COMPROBANTE.includes(tipoOp)) {
      setTipoComp('factura_a');
    } else {
      setTipoComp('');
    }
  }, [tipoOp]);

  // ── Al incluir un medio Cheque, mostrar una fila de cheque lista para completar ─
  useEffect(() => {
    const hayChequeAhora = pagoMedios.some(m => /cheque/i.test(mediosPago.find(mp => mp.id === m.medio_pago_id)?.nombre ?? ''));
    if (hayChequeAhora) {
      setCheques(prev => prev.length === 0 ? [{ banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' }] : prev);
    } else {
      setCheques([]);
    }
  }, [pagoMedios, mediosPago]);

  // ── IVA automático para facturas en blanco ────────────────────────────────
  useEffect(() => {
    if (!esFacturaEnBlanco(tipoComp)) return;
    const ng = parseFloat(netoGravado) || 0;
    setIva21((ng * 0.21).toFixed(2));
  }, [netoGravado, tipoComp]);

  // ── Total calculado de ítems ──────────────────────────────────────────────
  const totalItems = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (1 - i.descuento_pct / 100), 0);

  // ── Bonificaciones en cascada sobre el subtotal ───────────────────────────
  // Cada bonificación se aplica sobre el subtotal ya descontado por las
  // anteriores (ej. 6% → luego 3% sobre el resto), igual que en la factura.
  const bonif = bonificaciones.reduce<{ rows: { pct: number; monto: number }[]; neto: number }>(
    (acc, b) => {
      const pct = Math.max(0, Math.min(100, parseFloat(b.pct) || 0));
      // Se redondea cada bonificación a 2 decimales (pesos) y se resta ese valor,
      // igual que la factura del proveedor (Subtotal → Bonif.1 → Bonif.2 → Neto).
      const monto = parseFloat((acc.neto * pct / 100).toFixed(2));
      acc.rows.push({ pct, monto });
      acc.neto = parseFloat((acc.neto - monto).toFixed(2));
      return acc;
    },
    { rows: [], neto: totalItems }
  );
  const netoBonificado = bonif.neto;

  const addBonificacion = () => setBonificaciones(prev => [...prev, { pct: '' }]);
  const updBonificacion = (i: number, pct: string) =>
    setBonificaciones(prev => prev.map((b, idx) => (idx === i ? { pct } : b)));
  const removeBonificacion = (i: number) =>
    setBonificaciones(prev => prev.filter((_, idx) => idx !== i));

  // ── Diferencia total vs suma fiscal ──────────────────────────────────────
  const sumaFiscal = [netoGravado, netoNoGravado, iva21, iva105, percepcionesIb, otrosImpuestos]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalNum = parseFloat(totalComprobante) || 0;
  const difTotal = Math.abs(totalNum - sumaFiscal);
  const totalOk = !TIPOS_CON_COMPROBANTE.includes(tipoOp) || difTotal <= 0.02 || sumaFiscal === 0;

  // ── Auto-cálculo de montos desde los ítems (Compra de Mercadería) ──────────
  // Neto gravado = subtotal de los ítems cargados arriba. El IVA 21% deriva del
  // neto (effect de arriba). Los campos quedan editables para ajustes manuales
  // (percepciones, IVA 10.5%, etc.), pero se re-sincronizan si cambian los ítems.
  useEffect(() => {
    if (tipoOp !== 'compra_mercaderia' || !esFacturaEnBlanco(tipoComp)) return;
    setNetoGravado(netoBonificado > 0 ? netoBonificado.toFixed(2) : '');
  }, [netoBonificado, tipoOp, tipoComp]);

  // Total del comprobante = suma de netos + impuestos (factura en blanco) o el
  // subtotal de ítems (comprobante informal).
  useEffect(() => {
    if (tipoOp !== 'compra_mercaderia') return;
    const t = esFacturaEnBlanco(tipoComp) ? sumaFiscal : totalItems;
    setTotalComprobante(t > 0 ? t.toFixed(2) : '');
  }, [sumaFiscal, totalItems, tipoOp, tipoComp]);

  // Flete: porcentaje sobre el total del comprobante → monto en pesos.
  const fletePctNum = parseFloat(fletePct) || 0;
  const fleteMonto  = parseFloat((totalNum * fletePctNum / 100).toFixed(2));

  // ── Búsqueda de artículos ─────────────────────────────────────────────────
  const searchArticulos = useCallback((q: string) => {
    if (artDebounce.current) clearTimeout(artDebounce.current);
    if (!q.trim()) { setArtResults([]); return; }
    artDebounce.current = setTimeout(async () => {
      setArtLoading(true);
      try {
        const res = await apiFetch(`/api/articulos?q=${encodeURIComponent(q)}&limit=10`);
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
        descuento_pct: 0,
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
      descuento_pct: 0,
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

  // ── Medios de pago (pago dividido) ────────────────────────────────────────
  const nombreMedio    = (id: string) => mediosPago.find(m => m.id === id)?.nombre ?? '';
  const esChequeId     = (id: string) => /cheque/i.test(nombreMedio(id));
  const requiereCuenta = (id: string) => !!mediosPago.find(m => m.id === id)?.requiere_cuenta;
  const hayCheque      = pagoMedios.some(m => esChequeId(m.medio_pago_id));

  const totalCheques   = cheques.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
  const montoLinea     = (m: { medio_pago_id: string; monto: string }) =>
    esChequeId(m.medio_pago_id) ? totalCheques : (parseFloat(m.monto) || 0);
  const totalPagoMedios = pagoMedios.reduce((s, m) => s + montoLinea(m), 0);

  const addMedioPago = () => {
    const usados = new Set(pagoMedios.map(m => m.medio_pago_id));
    const libre = mediosPago.find(m => !usados.has(m.id)) ?? mediosPago[0];
    if (libre) setPagoMedios(p => [...p, { medio_pago_id: libre.id, monto: '', cuenta_bancaria_id: '' }]);
  };
  const updMedioPago = (i: number, f: 'medio_pago_id' | 'monto' | 'cuenta_bancaria_id', v: string) =>
    setPagoMedios(p => p.map((m, j) => j === i ? { ...m, [f]: v } : m));
  const delMedioPago = (i: number) => setPagoMedios(p => p.length > 1 ? p.filter((_, j) => j !== i) : p);
  const restoMedioPago = (i: number) => {
    const objetivo = parseFloat(totalComprobante) || 0;
    return +(objetivo - pagoMedios.reduce((s, m, j) => s + (j === i ? 0 : montoLinea(m)), 0)).toFixed(2);
  };

  const esCheque = hayCheque;

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
    if (estadoPago === 'pagado') {
      if (pagoMedios.length === 0 || pagoMedios.some(m => !m.medio_pago_id)) return setSaveError('Seleccioná el medio de pago');
      if (pagoMedios.some(m => !esChequeId(m.medio_pago_id) && montoLinea(m) <= 0)) return setSaveError('Ingresá el monto de cada medio de pago');
      if (pagoMedios.some(m => requiereCuenta(m.medio_pago_id) && !m.cuenta_bancaria_id)) return setSaveError('Seleccioná la cuenta bancaria del medio correspondiente');
      if (hayCheque && cheques.filter(c => c.fecha_vencimiento && c.importe).length === 0) return setSaveError('Cargá el detalle de los cheques');
      if (totalPagoMedios <= 0) return setSaveError('El monto pagado debe ser mayor a 0');
      if (totalPagoMedios - parseFloat(totalComprobante) > 0.01) return setSaveError('El pago no puede superar el total del comprobante');
    }

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
      costo_flete: fleteMonto,
      estado_pago: estadoPago === 'pagado' ? 'pagado' : 'pendiente',
      fecha_vencimiento_pago: fechaVenc || null,
      anticipo_id: vincularAnticipo && anticipoId ? anticipoId : null,
      items: items.map(i => ({
        articulo_id: i.articulo_id || null,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento_pct: i.descuento_pct || 0,
        sucursal_imputacion_id: i.sucursal_imputacion_id || sucursalId,
      })),
      bonificaciones: bonif.rows
        .filter(b => b.pct > 0)
        .map(b => ({ pct: b.pct, monto: parseFloat(b.monto.toFixed(2)) })),
    };

    if (estadoPago === 'pagado' && pagoMedios.length > 0) {
      body.pago = {
        monto: totalPagoMedios,
        medios: pagoMedios.map(m => ({
          medio_pago_id: m.medio_pago_id,
          monto: montoLinea(m),
          cuenta_bancaria_id: m.cuenta_bancaria_id || null,
        })),
        cheques: hayCheque ? cheques.filter(c => c.banco && c.numero_cheque && c.fecha_vencimiento && c.importe) : [],
      };
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/egresos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Error al guardar'); return; }
      // Compra de mercadería → ir al pedido generado para confirmar recepción
      if (data.pedido_creado?.id) {
        router.push(`/pedidos-proveedores/${data.pedido_creado.id}`);
      } else {
        router.push('/gastos');
      }
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
          ← Volver a Egresos
        </Link>
      </div>

      {/* ── Tipo simplificado: Mercadería o Gasto Varios ─── */}
      <div className="flex gap-3">
        {([
          ['compra_mercaderia', 'Compra de Mercadería', 'Actualiza stock · requiere artículos'],
          ['compra_gasto',      'Gasto Varios',         'Servicios, insumos · sin stock'],
        ] as [TipoOperacion, string, string][]).map(([val, label, hint]) => (
          <button
            key={val}
            type="button"
            onClick={() => setTipoOp(val)}
            className={[
              'flex-1 text-left px-5 py-3.5 rounded-xl border-2 transition-colors',
              tipoOp === val
                ? 'border-kp-red bg-kp-red/10'
                : 'border-kp-border bg-kp-surface hover:border-kp-gray',
            ].join(' ')}
          >
            <div className={`text-sm font-bold ${tipoOp === val ? 'text-kp-white' : 'text-kp-gray-lt'}`}>
              {tipoOp === val && <span className="inline-block w-2 h-2 rounded-full bg-kp-red mr-2 align-middle" />}
              {label}
            </div>
            <div className="text-xs text-kp-gray mt-0.5">{hint}</div>
          </button>
        ))}
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

            {/* Acceso rápido: Compra de mercadería (más usado) */}
            {(() => {
              const subCompra = rubros.flatMap(r => r.subrubros).find(
                s => s.nombre.toLowerCase().includes('compra de mercader')
              );
              if (!subCompra) return null;
              const activo = subrubroId === subCompra.id;
              return (
                <button
                  type="button"
                  onClick={() => setSubrubroId(activo ? '' : subCompra.id)}
                  className={[
                    'w-full flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors',
                    activo
                      ? 'border-kp-red bg-kp-red/10 text-kp-white'
                      : 'border-amber-500/50 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10',
                  ].join(' ')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
                    <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  Compra de mercadería
                  {activo && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      className="w-4 h-4 ml-auto text-kp-red">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {!activo && <span className="ml-auto text-xs opacity-60">más usado</span>}
                </button>
              );
            })()}

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
                    <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-20">Dto. %</th>
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
                        <NumericInput
                          value={item.cantidad}
                          onChange={e => updateItem(item.key, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NumericInput
                          decimals={3}
                          value={item.precio_unitario}
                          onChange={e => updateItem(item.key, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <input
                            type="number" min="0" max="100" step="0.1"
                            value={item.descuento_pct || ''}
                            placeholder="0"
                            onChange={e => updateItem(item.key, 'descuento_pct', parseFloat(e.target.value) || 0)}
                            className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 pr-5 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-kp-gray pointer-events-none">%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-sm text-kp-white font-semibold">
                        {ars.format(item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100))}
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
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold uppercase tracking-widest text-kp-gray">
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

      {/* ── Bonificaciones / descuento extra sobre el subtotal ─── */}
      {tipoOp === 'compra_mercaderia' && esFacturaEnBlanco(tipoComp) && items.length > 0 && (
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
              Bonificaciones sobre el subtotal
            </h3>
            <button
              type="button"
              onClick={addBonificacion}
              className="text-xs font-semibold text-kp-red hover:underline"
            >
              + Agregar bonificación
            </button>
          </div>

          {bonificaciones.length === 0 ? (
            <p className="text-[11px] text-kp-gray/70">
              Descuento extra que el proveedor aplica sobre el total de la lista (aparte del
              descuento por línea). Se aplican en cascada, en el orden cargado.
            </p>
          ) : (
            <div className="space-y-2">
              {bonificaciones.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-kp-gray w-16">Bonif. {i + 1}</span>
                  <div className="relative w-28">
                    <NumericInput
                      decimals={2}
                      value={b.pct}
                      onChange={e => updBonificacion(i, e.target.value)}
                      placeholder="0"
                      className={inputCls + ' pr-6 text-right'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
                  </div>
                  <span className="text-sm text-kp-gray-lt tabular-nums flex-1 text-right">
                    − {ars.format(bonif.rows[i]?.monto ?? 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBonificacion(i)}
                    className="text-kp-gray hover:text-kp-red text-lg leading-none px-1"
                    aria-label="Quitar bonificación"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-kp-border pt-2 mt-1">
                <span className="text-xs font-bold uppercase tracking-widest text-kp-gray">
                  Neto tras bonificaciones
                </span>
                <span className="text-sm font-bold tabular-nums text-kp-white">
                  {ars.format(netoBonificado)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sección 6: Impuestos y totales ─── */}
      <div className={sectionCls}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
          {tipoOp === 'compra_mercaderia' ? 'Montos y totales' : 'Total de la compra'}
        </h3>

        {/* Campos fiscales — solo Compra de Mercadería con factura en blanco */}
        {tipoOp === 'compra_mercaderia' && esFacturaEnBlanco(tipoComp) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Neto gravado *</label>
              <NumericInput placeholder="0.00" value={netoGravado}
                onChange={e => setNetoGravado(e.target.value)} className={inputCls} />
              {items.length > 0 && (
                <p className="text-[10px] text-kp-gray/70 mt-1">
                  {bonif.rows.length > 0
                    ? 'Calculado de los ítems menos bonificaciones. Editable.'
                    : 'Calculado de los ítems. Editable.'}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Neto no gravado / exento</label>
              <NumericInput placeholder="0.00" value={netoNoGravado}
                onChange={e => setNetoNoGravado(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IVA 21% (auto)</label>
              <NumericInput placeholder="0.00" value={iva21}
                onChange={e => setIva21(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IVA 10.5%</label>
              <NumericInput placeholder="0.00" value={iva105}
                onChange={e => setIva105(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Percepciones IIBB</label>
              <NumericInput placeholder="0.00" value={percepcionesIb}
                onChange={e => setPercepcionesIb(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Otros impuestos</label>
              <NumericInput placeholder="0.00" value={otrosImpuestos}
                onChange={e => setOtrosImpuestos(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        {/* Total del comprobante — siempre visible */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`${labelCls} text-kp-white`}>Total del comprobante *</label>
            <NumericInput
              placeholder="0.00"
              value={totalComprobante}
              onChange={e => setTotalComprobante(e.target.value)}
              className={`${inputCls} text-lg font-bold ${TIPOS_CON_COMPROBANTE.includes(tipoOp) && !totalOk && totalNum > 0 && sumaFiscal > 0 ? 'border-kp-red' : ''}`}
            />
          </div>

          {/* Indicador de validación de total — solo para Mercadería */}
          {tipoOp === 'compra_mercaderia' && esFacturaEnBlanco(tipoComp) && totalNum > 0 && sumaFiscal > 0 && (
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

      {/* ── Costo de flete (solo Compra de Mercadería) — egreso aparte, subrubro "Transporte de carga" ── */}
      {tipoOp === 'compra_mercaderia' && (
      <div className={sectionCls}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Costo de flete</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Costo de flete (% del total)</label>
            <div className="relative">
              <NumericInput
                placeholder="0.00"
                value={fletePct}
                onChange={e => setFletePct(e.target.value)}
                className={`${inputCls} pr-7`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-sm">%</span>
            </div>
            {fletePctNum > 0 && (
              <p className="text-xs text-kp-gray mt-1.5">
                = <span className="text-kp-white font-semibold">{ars.format(fleteMonto)}</span>
                <span className="text-kp-gray/70"> sobre {ars.format(totalNum)}</span>
              </p>
            )}
          </div>
          <div className="flex items-end pb-1">
            <p className="text-xs text-kp-gray/70">
              Se calcula como porcentaje del total del comprobante y se registra como
              un egreso aparte en el subrubro
              <span className="text-kp-gray"> «Transporte de carga»</span>. No se suma al total del comprobante.
            </p>
          </div>
        </div>
      </div>
      )}

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
          <div className="space-y-2 pt-2 border-t border-kp-border">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Medios de pago * <span className="normal-case text-kp-gray/60">— podés dividir el pago</span></label>
              <button type="button" onClick={addMedioPago}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-kp-red/90 hover:bg-kp-red transition-colors px-3 py-1.5 rounded-lg shadow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3.5 h-3.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar medio
              </button>
            </div>

            {pagoMedios.map((m, i) => {
              const cheque = esChequeId(m.medio_pago_id);
              const cuenta = requiereCuenta(m.medio_pago_id);
              const resto  = restoMedioPago(i);
              return (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end rounded-lg border border-kp-border bg-kp-surface/60 p-2">
                  <div className="sm:col-span-4">
                    <label className={labelCls}>Medio</label>
                    <select value={m.medio_pago_id} onChange={e => updMedioPago(i, 'medio_pago_id', e.target.value)} className={inputCls}>
                      {mediosPago.map(mp => <option key={mp.id} value={mp.id}>{mp.nombre}</option>)}
                    </select>
                  </div>
                  <div className={cuenta ? 'sm:col-span-4' : 'sm:col-span-7'}>
                    <div className="flex items-center justify-between">
                      <label className={labelCls}>Monto</label>
                      {!cheque && resto > 0 && (
                        <button type="button" onClick={() => updMedioPago(i, 'monto', String(resto))}
                          className="text-[10px] text-kp-red hover:underline mb-1">usar resto {ars.format(resto)}</button>
                      )}
                    </div>
                    {cheque
                      ? <div className={`${inputCls} flex items-center justify-between text-kp-gray-lt`}>
                          <span className="tabular-nums">{ars.format(totalCheques)}</span>
                          <span className="text-[10px] text-kp-gray">según cheques ↓</span>
                        </div>
                      : <NumericInput value={m.monto} placeholder="0.00" onChange={e => updMedioPago(i, 'monto', e.target.value)} className={inputCls} />
                    }
                  </div>
                  {cuenta && (
                    <div className="sm:col-span-3">
                      <label className={labelCls}>Cuenta *</label>
                      <select value={m.cuenta_bancaria_id} onChange={e => updMedioPago(i, 'cuenta_bancaria_id', e.target.value)} className={inputCls}>
                        <option value="">— Cuenta —</option>
                        {cuentasBancarias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-1 flex justify-end">
                    {pagoMedios.length > 1 && (
                      <button type="button" onClick={() => delMedioPago(i)} title="Quitar medio"
                        className="text-kp-gray hover:text-kp-red px-2 py-2">✕</button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Total pagado */}
            <div className="flex items-center justify-between rounded-lg bg-kp-surface2 border border-kp-border px-4 py-2">
              <span className="text-xs uppercase tracking-widest text-kp-gray">Total pagado</span>
              <div className="text-right">
                <span className={`text-sm font-bold tabular-nums ${totalPagoMedios > 0 && Math.abs(totalPagoMedios - (parseFloat(totalComprobante) || 0)) <= 0.01 ? 'text-green-400' : 'text-kp-white'}`}>
                  {ars.format(totalPagoMedios)}
                </span>
                {parseFloat(totalComprobante) > 0 && totalPagoMedios > 0 && totalPagoMedios < parseFloat(totalComprobante) - 0.01 && (
                  <span className="block text-[11px] text-amber-400">Pago parcial — quedan {ars.format(parseFloat(totalComprobante) - totalPagoMedios)}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cheques */}
        {estadoPago === 'pagado' && esCheque && (
          <div className="space-y-3 pt-2 border-t border-kp-border">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Cheques</p>
              <button type="button" onClick={addCheque}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-kp-red/90 hover:bg-kp-red transition-colors px-3 py-1.5 rounded-lg shadow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
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
                    <NumericInput placeholder="0.00" value={ch.importe}
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
                <span className="tabular-nums font-bold text-kp-white">{ars.format(totalCheques)}</span>
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
