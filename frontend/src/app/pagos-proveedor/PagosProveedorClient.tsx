'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import NumericInput from '@/components/NumericInput';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Proveedor {
  id: string;
  razon_social: string;
  cuit: string | null;
  saldo_facturado?: string | null;
  saldo_no_facturado?: string | null;
}
interface EgresoPendiente {
  id: string;
  tipo_comprobante: string | null;
  punto_venta: string | null;
  numero_comprobante: string | null;
  fecha_emision: string;
  descripcion: string;
  total: string;
  estado_pago: 'pendiente' | 'parcial';
  fecha_vencimiento_pago: string | null;
}
interface MedioPago { id: string; nombre: string; requiere_cuenta: boolean }
interface Cuenta   { id: string; nombre: string }
interface Sucursal { id: string; nombre: string }
interface Cheque   { banco: string; numero_cheque: string; fecha_vencimiento: string; importe: string }
interface MedioLinea { medio_pago_id: string; monto: string; cuenta_bancaria_id: string }
interface PagoHist {
  id: string;
  fecha: string;
  monto: string;
  medio_pago_nombre: string;
  sucursal_nombre: string | null;
  observaciones: string | null;
  anulado: boolean;
  aplicaciones_count: string;
  proveedor_nombre?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? '—' : ars.format(n); };
const fmtFecha = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR'); };
const hoyAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

const TIPO_COMP_LABEL: Record<string, string> = {
  factura_a: 'Fac. A', factura_b: 'Fac. B', factura_c: 'Fac. C',
  nota_debito_a: 'ND A', nota_debito_b: 'ND B', nota_debito_c: 'ND C',
  nota_credito_a: 'NC A', nota_credito_b: 'NC B', nota_credito_c: 'NC C',
  informal: 'Informal',
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PagosProveedorClient() {
  // Catálogos
  const [proveedores, setProveedores]     = useState<Proveedor[]>([]);
  const [mediosPago, setMediosPago]       = useState<MedioPago[]>([]);
  const [cuentas, setCuentas]             = useState<Cuenta[]>([]);
  const [sucursales, setSucursales]       = useState<Sucursal[]>([]);

  // Selección de proveedor
  const [busca, setBusca]                 = useState('');
  const [proveedorId, setProveedorId]     = useState('');
  const [pendientes, setPendientes]       = useState<EgresoPendiente[]>([]);
  const [loadingPend, setLoadingPend]     = useState(false);
  const [historial, setHistorial]         = useState<PagoHist[]>([]);

  // Registro global de todos los pagos a proveedores (siempre visible)
  const [todosPagos, setTodosPagos]       = useState<PagoHist[]>([]);
  const [loadingTodos, setLoadingTodos]   = useState(false);
  const [filtroRegistro, setFiltroRegistro] = useState('');

  // Modo de pago
  const [modo, setModo]                   = useState<'aplicar' | 'cuenta'>('aplicar');

  // Aplicar a comprobantes: { egresoId: { sel, monto } }
  const [aplic, setAplic]                 = useState<Record<string, { sel: boolean; monto: string; pend: number }>>({});

  // Pago a cuenta
  const [montoCuenta, setMontoCuenta]     = useState('');
  const [facturado, setFacturado]         = useState(false);

  // Forma de pago (uno o varios medios: pago dividido)
  const [medios, setMedios]               = useState<MedioLinea[]>([]);
  const [sucursalId, setSucursalId]       = useState('');
  const [fecha, setFecha]                 = useState(hoyAR());
  const [observaciones, setObs]           = useState('');
  const [cheques, setCheques]             = useState<Cheque[]>([]);

  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [okMsg, setOkMsg]                 = useState<string | null>(null);

  // Anulación de un pago del historial
  const [anularTarget, setAnularTarget]   = useState<PagoHist | null>(null);
  const [motivoAnular, setMotivoAnular]   = useState('');
  const [anulando, setAnulando]           = useState(false);
  const [anularError, setAnularError]     = useState<string | null>(null);

  // ── Cargar catálogos ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiFetch('/api/proveedores?limit=500&activo=all').then(r => r.json()).catch(() => ({ proveedores: [] })),
      apiFetch('/api/ventas/medios-pago').then(r => r.json()).catch(() => ({ medios: [] })),
      apiFetch('/api/cuentas-bancarias').then(r => r.json()).catch(() => ({ cuentas: [] })),
      apiFetch('/api/sucursales').then(r => r.json()).catch(() => ({ sucursales: [] })),
    ]).then(([prov, mp, cb, suc]) => {
      setProveedores(prov.proveedores ?? []);
      const mediosArr: MedioPago[] = mp.medios ?? mp.medios_pago ?? [];
      setMediosPago(mediosArr);
      if (mediosArr.length > 0) setMedios([{ medio_pago_id: mediosArr[0].id, monto: '', cuenta_bancaria_id: '' }]);
      setCuentas(cb.cuentas ?? []);
      const sArr = suc.sucursales ?? [];
      setSucursales(sArr);
      if (sArr.length > 0) {
        const laprida = sArr.find((s: Sucursal) => /laprida/i.test(s.nombre));
        setSucursalId((laprida ?? sArr[0]).id);
      }
    });
  }, []);

  // ── Cargar pendientes + historial al elegir proveedor ──────────────────────
  const cargarProveedor = useCallback(async (id: string) => {
    setLoadingPend(true);
    setError(null); setOkMsg(null);
    try {
      const [pend, hist] = await Promise.all([
        apiFetch(`/api/egresos/pendientes?proveedor_id=${id}&limit=200`).then(r => r.json()).catch(() => ({ egresos: [] })),
        apiFetch(`/api/pagos-proveedor?proveedor_id=${id}&limit=20`).then(r => r.json()).catch(() => ({ pagos: [] })),
      ]);
      const egresos: EgresoPendiente[] = pend.egresos ?? [];
      setPendientes(egresos);
      setHistorial(hist.pagos ?? []);
      // Inicializar mapa de aplicaciones (monto pendiente aún no considera pagos
      // parciales; el backend valida el tope real por comprobante)
      const map: Record<string, { sel: boolean; monto: string; pend: number }> = {};
      for (const e of egresos) {
        map[e.id] = { sel: false, monto: parseFloat(e.total).toFixed(2), pend: parseFloat(e.total) };
      }
      setAplic(map);
    } finally {
      setLoadingPend(false);
    }
  }, []);

  useEffect(() => {
    if (proveedorId) cargarProveedor(proveedorId);
    else { setPendientes([]); setHistorial([]); setAplic({}); }
  }, [proveedorId, cargarProveedor]);

  // ── Registro global: todos los pagos a proveedores ─────────────────────────
  const cargarTodos = useCallback(async () => {
    setLoadingTodos(true);
    try {
      const data = await apiFetch('/api/pagos-proveedor?limit=200&incluir_anulados=true')
        .then(r => r.json()).catch(() => ({ pagos: [] }));
      setTodosPagos(data.pagos ?? []);
    } finally {
      setLoadingTodos(false);
    }
  }, []);

  useEffect(() => { cargarTodos(); }, [cargarTodos]);

  const registroFiltrado = useMemo(() => {
    const q = filtroRegistro.trim().toLowerCase();
    if (!q) return todosPagos;
    return todosPagos.filter(p =>
      (p.proveedor_nombre ?? '').toLowerCase().includes(q) ||
      (p.observaciones ?? '').toLowerCase().includes(q) ||
      (p.medio_pago_nombre ?? '').toLowerCase().includes(q));
  }, [filtroRegistro, todosPagos]);

  // ── Derivados ──────────────────────────────────────────────────────────────
  const proveedor = proveedores.find(p => p.id === proveedorId);
  const saldoProv = proveedor
    ? (parseFloat(proveedor.saldo_facturado ?? '0') || 0) + (parseFloat(proveedor.saldo_no_facturado ?? '0') || 0)
    : 0;

  const provFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter(p =>
      p.razon_social.toLowerCase().includes(q) || (p.cuit ?? '').toLowerCase().includes(q));
  }, [busca, proveedores]);

  // Helpers por medio de pago
  const nombreMedio    = (id: string) => mediosPago.find(m => m.id === id)?.nombre ?? '';
  const esEfectivoId   = (id: string) => /efectivo/i.test(nombreMedio(id));
  const esChequeId     = (id: string) => /cheque/i.test(nombreMedio(id));
  const requiereCuenta = (id: string) => !!mediosPago.find(m => m.id === id)?.requiere_cuenta;

  const hayEfectivo = medios.some(m => esEfectivoId(m.medio_pago_id));
  const hayCheque   = medios.some(m => esChequeId(m.medio_pago_id));

  const totalCheques = cheques.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
  // Monto efectivo de una línea: si es cheque, lo determina el detalle de cheques.
  const montoLinea = (m: MedioLinea) => esChequeId(m.medio_pago_id) ? totalCheques : (parseFloat(m.monto) || 0);
  const totalMedios = medios.reduce((s, m) => s + montoLinea(m), 0);

  // Al incluir un medio Cheque, mostrar una fila de cheque lista para completar;
  // al quitarlo, limpiar las filas cargadas.
  useEffect(() => {
    if (hayCheque) {
      setCheques(prev => prev.length === 0
        ? [{ banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' }]
        : prev);
    } else {
      setCheques([]);
    }
  }, [hayCheque]);

  const totalAplicado = useMemo(() =>
    Object.values(aplic).reduce((s, a) => s + (a.sel ? (parseFloat(a.monto) || 0) : 0), 0),
    [aplic]);

  const totalPago = modo === 'aplicar' ? totalAplicado : (parseFloat(montoCuenta) || 0);

  // ── Mutadores ───────────────────────────────────────────────────────────────
  const toggleEgreso = (id: string) => setAplic(p => ({ ...p, [id]: { ...p[id], sel: !p[id].sel } }));
  const setMontoEgreso = (id: string, v: string) => setAplic(p => ({ ...p, [id]: { ...p[id], monto: v } }));
  const seleccionarTodos = (sel: boolean) =>
    setAplic(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, sel }])));

  // Medios de pago (líneas)
  const addMedio = () => {
    const usados = new Set(medios.map(m => m.medio_pago_id));
    const libre = mediosPago.find(m => !usados.has(m.id)) ?? mediosPago[0];
    if (libre) setMedios(p => [...p, { medio_pago_id: libre.id, monto: '', cuenta_bancaria_id: '' }]);
  };
  const updMedio = (i: number, f: keyof MedioLinea, v: string) =>
    setMedios(p => p.map((m, j) => j === i ? { ...m, [f]: v } : m));
  const delMedio = (i: number) => setMedios(p => p.length > 1 ? p.filter((_, j) => j !== i) : p);
  // Autocompletar el monto de una línea con lo que falta para llegar al total
  const restoMedio = (i: number) => +(totalPago - medios.reduce((s, m, j) => s + (j === i ? 0 : montoLinea(m)), 0)).toFixed(2);

  const addCheque = () => setCheques(p => [...p, { banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' }]);
  const updCheque = (i: number, f: keyof Cheque, v: string) => setCheques(p => p.map((c, j) => j === i ? { ...c, [f]: v } : c));
  const delCheque = (i: number) => setCheques(p => p.filter((_, j) => j !== i));

  // ── Envío ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    setError(null); setOkMsg(null);
    if (!proveedorId) return setError('Seleccioná un proveedor');
    if (medios.length === 0 || medios.some(m => !m.medio_pago_id)) return setError('Seleccioná el medio de pago');
    if (totalPago <= 0) return setError('El monto a pagar debe ser mayor a 0');
    if (medios.some(m => !esChequeId(m.medio_pago_id) && montoLinea(m) <= 0)) return setError('Ingresá el monto de cada medio de pago');
    if (medios.some(m => requiereCuenta(m.medio_pago_id) && !m.cuenta_bancaria_id)) return setError('Seleccioná la cuenta bancaria del medio correspondiente');
    if (Math.abs(totalMedios - totalPago) > 0.01) {
      return setError(`Los medios de pago (${ars.format(totalMedios)}) deben sumar el total a pagar (${ars.format(totalPago)})`);
    }
    if (hayCheque && cheques.filter(c => c.fecha_vencimiento && c.importe).length === 0) {
      return setError('Cargá el detalle de los cheques');
    }

    const aplicaciones = modo === 'aplicar'
      ? Object.entries(aplic).filter(([, a]) => a.sel && parseFloat(a.monto) > 0)
          .map(([egreso_id, a]) => ({ egreso_id, monto: parseFloat(a.monto) }))
      : [];

    if (modo === 'aplicar' && aplicaciones.length === 0) return setError('Seleccioná al menos un comprobante a pagar');

    const body = {
      proveedor_id: proveedorId,
      monto: totalPago,
      fecha,
      sucursal_id: sucursalId || null,
      observaciones: observaciones.trim() || null,
      facturado: modo === 'cuenta' ? facturado : undefined,
      aplicaciones,
      medios: medios.map(m => ({
        medio_pago_id: m.medio_pago_id,
        monto: montoLinea(m),
        cuenta_bancaria_id: m.cuenta_bancaria_id || null,
      })),
      cheques: hayCheque ? cheques.filter(c => c.banco && c.numero_cheque && c.fecha_vencimiento && c.importe) : [],
    };

    setSaving(true);
    try {
      const res = await apiFetch('/api/pagos-proveedor', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al registrar el pago'); return; }
      setOkMsg(`Pago de ${ars.format(totalPago)} registrado correctamente.`);
      // Reset del formulario y recarga del proveedor (saldos actualizados)
      setMontoCuenta(''); setObs(''); setCheques([]);
      setMedios(mediosPago.length > 0 ? [{ medio_pago_id: mediosPago[0].id, monto: '', cuenta_bancaria_id: '' }] : []);
      await recargarSaldos();
      await cargarProveedor(proveedorId);
      await cargarTodos();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setSaving(false);
    }
  };

  const recargarSaldos = async () => {
    const prov = await apiFetch('/api/proveedores?limit=500&activo=all').then(r => r.json()).catch(() => ({ proveedores: [] }));
    setProveedores(prov.proveedores ?? []);
  };

  const confirmarAnular = async () => {
    if (!anularTarget) return;
    setAnularError(null);
    if (!motivoAnular.trim()) { setAnularError('Ingresá el motivo de la anulación'); return; }
    setAnulando(true);
    try {
      const res = await apiFetch(`/api/pagos-proveedor/${anularTarget.id}/anular`, {
        method: 'POST', body: JSON.stringify({ motivo: motivoAnular.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAnularError(data.error ?? 'Error al anular el pago'); return; }
      setAnularTarget(null);
      setMotivoAnular('');
      setOkMsg('Pago anulado.');
      await recargarSaldos();
      if (proveedorId) await cargarProveedor(proveedorId);
      await cargarTodos();
    } catch {
      setAnularError('Error de conexión con el servidor');
    } finally {
      setAnulando(false);
    }
  };

  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';
  const cardCls  = 'rounded-xl border border-kp-border p-5 space-y-4 bg-kp-surface';

  return (
    <section className="space-y-5 pb-12">
      {/* Encabezado */}
      <div className="flex items-center gap-2">
        <span className="w-1 h-6 bg-kp-red rounded-full block" />
        <h2 className="text-2xl font-bold uppercase tracking-wide">Pago a Proveedores</h2>
      </div>

      {/* ── Selección de proveedor ── */}
      <div className={cardCls}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Proveedor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Buscar</label>
            <input type="search" placeholder="Razón social o CUIT…" value={busca}
              onChange={e => setBusca(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Proveedor *</label>
            <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className={inputCls}>
              <option value="">— Seleccionar —</option>
              {provFiltrados.map(p => (
                <option key={p.id} value={p.id}>{p.razon_social}{p.cuit ? ` (${p.cuit})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
        {proveedor && (
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <div className="rounded-lg bg-kp-surface2 border border-kp-border px-4 py-2">
              <span className="block text-[11px] uppercase tracking-widest text-kp-gray">Saldo que le debemos</span>
              <span className={`text-lg font-bold tabular-nums ${saldoProv > 0.005 ? 'text-kp-red' : saldoProv < -0.005 ? 'text-green-400' : 'text-kp-gray'}`}>
                {fmt(saldoProv)}
              </span>
            </div>
            <a href="/proveedores" className="text-xs text-kp-gray hover:text-kp-white underline">Ver cuenta corriente completa →</a>
          </div>
        )}
      </div>

      {proveedorId && (
        <>
          {/* ── Modo de pago ── */}
          <div className="flex gap-3">
            {([
              ['aplicar', 'Aplicar a comprobantes', 'Pagar facturas/egresos pendientes'],
              ['cuenta',  'Pago a cuenta',           'Descontar del saldo global'],
            ] as [typeof modo, string, string][]).map(([val, label, hint]) => (
              <button key={val} type="button" onClick={() => setModo(val)}
                className={['flex-1 text-left px-5 py-3 rounded-xl border-2 transition-colors',
                  modo === val ? 'border-kp-red bg-kp-red/10' : 'border-kp-border bg-kp-surface hover:border-kp-gray'].join(' ')}>
                <div className={`text-sm font-bold ${modo === val ? 'text-kp-white' : 'text-kp-gray-lt'}`}>
                  {modo === val && <span className="inline-block w-2 h-2 rounded-full bg-kp-red mr-2 align-middle" />}{label}
                </div>
                <div className="text-xs text-kp-gray mt-0.5">{hint}</div>
              </button>
            ))}
          </div>

          {/* ── Aplicar a comprobantes ── */}
          {modo === 'aplicar' && (
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Comprobantes pendientes ({pendientes.length})</h3>
                {pendientes.length > 0 && (
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => seleccionarTodos(true)} className="text-kp-gray hover:text-kp-white underline">Todos</button>
                    <button onClick={() => seleccionarTodos(false)} className="text-kp-gray hover:text-kp-white underline">Ninguno</button>
                  </div>
                )}
              </div>

              {loadingPend ? (
                <div className="flex justify-center py-10 text-kp-gray"><Spinner /></div>
              ) : pendientes.length === 0 ? (
                <p className="text-center py-8 text-sm text-kp-gray">Este proveedor no tiene comprobantes pendientes de pago. Usá «Pago a cuenta» si querés registrar un pago igual.</p>
              ) : (
                <div className="rounded-xl border border-kp-border overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-kp-surface2 border-b border-kp-border">
                        <th className="w-8 px-3 py-2" />
                        <th className="text-left px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Comprobante</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Descripción</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Venc.</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Total</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest w-36">A pagar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-kp-border">
                      {pendientes.map(e => {
                        const a = aplic[e.id];
                        return (
                          <tr key={e.id} className={`bg-kp-surface transition-colors ${a?.sel ? 'bg-kp-red/5' : 'hover:bg-kp-surface2'}`}>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={a?.sel ?? false} onChange={() => toggleEgreso(e.id)} className="rounded border-kp-border" />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="text-xs font-semibold text-kp-white">{TIPO_COMP_LABEL[e.tipo_comprobante ?? ''] ?? e.tipo_comprobante ?? '—'}</span>
                              {e.numero_comprobante && <span className="ml-1 text-xs text-kp-gray font-mono">{e.punto_venta ? `${e.punto_venta}-` : ''}{e.numero_comprobante}</span>}
                              {e.estado_pago === 'parcial' && <span className="ml-1 text-[10px] text-blue-400">(parcial)</span>}
                            </td>
                            <td className="px-3 py-2 text-xs text-kp-gray-lt max-w-[220px] truncate">{e.descripcion}</td>
                            <td className="px-3 py-2 text-center text-xs text-kp-gray whitespace-nowrap">{e.fecha_vencimiento_pago ? fmtFecha(e.fecha_vencimiento_pago) : '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-xs text-kp-gray-lt">{fmt(e.total)}</td>
                            <td className="px-3 py-2">
                              <NumericInput value={a?.monto ?? ''} disabled={!a?.sel}
                                onChange={ev => setMontoEgreso(e.id, ev.target.value)}
                                className={`w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red disabled:opacity-40`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Pago a cuenta ── */}
          {modo === 'cuenta' && (
            <div className={cardCls}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Pago a cuenta</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Monto a pagar *</label>
                  <NumericInput placeholder="0.00" value={montoCuenta} onChange={e => setMontoCuenta(e.target.value)}
                    className={`${inputCls} text-lg font-bold`} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-kp-gray-lt">
                    <input type="checkbox" checked={facturado} onChange={e => setFacturado(e.target.checked)} className="rounded border-kp-border" />
                    Imputar como <span className="text-kp-white font-semibold">facturado</span> (por defecto: no facturado)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Forma de pago ── */}
          <div className={cardCls}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Forma de pago</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sucursal</label>
                <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className={inputCls}>
                  <option value="">— Sin asignar —</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Medios de pago (uno o varios: pago dividido) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelCls}>Medios de pago * <span className="normal-case text-kp-gray/60">— podés dividir el pago</span></label>
                <button type="button" onClick={addMedio}
                  className="flex items-center gap-1 text-xs font-semibold text-white bg-kp-red/90 hover:bg-kp-red transition-colors px-3 py-1.5 rounded-lg shadow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3.5 h-3.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Agregar medio
                </button>
              </div>

              {medios.map((m, i) => {
                const cheque = esChequeId(m.medio_pago_id);
                const cuenta = requiereCuenta(m.medio_pago_id);
                const resto  = restoMedio(i);
                return (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end rounded-lg border border-kp-border bg-kp-surface2/40 p-2">
                    <div className="sm:col-span-4">
                      <label className={labelCls}>Medio</label>
                      <select value={m.medio_pago_id} onChange={e => updMedio(i, 'medio_pago_id', e.target.value)} className={inputCls}>
                        {mediosPago.map(mp => <option key={mp.id} value={mp.id}>{mp.nombre}</option>)}
                      </select>
                    </div>
                    <div className={cuenta ? 'sm:col-span-4' : 'sm:col-span-7'}>
                      <div className="flex items-center justify-between">
                        <label className={labelCls}>Monto</label>
                        {!cheque && resto > 0 && (
                          <button type="button" onClick={() => updMedio(i, 'monto', String(resto))}
                            className="text-[10px] text-kp-red hover:underline mb-1">usar resto {fmt(resto)}</button>
                        )}
                      </div>
                      {cheque
                        ? <div className={`${inputCls} flex items-center justify-between text-kp-gray-lt`}>
                            <span className="tabular-nums">{fmt(totalCheques)}</span>
                            <span className="text-[10px] text-kp-gray">según cheques ↓</span>
                          </div>
                        : <NumericInput value={m.monto} placeholder="0.00" onChange={e => updMedio(i, 'monto', e.target.value)} className={inputCls} />
                      }
                    </div>
                    {cuenta && (
                      <div className="sm:col-span-3">
                        <label className={labelCls}>Cuenta *</label>
                        <select value={m.cuenta_bancaria_id} onChange={e => updMedio(i, 'cuenta_bancaria_id', e.target.value)} className={inputCls}>
                          <option value="">— Cuenta —</option>
                          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="sm:col-span-1 flex justify-end">
                      {medios.length > 1 && (
                        <button type="button" onClick={() => delMedio(i)} title="Quitar medio"
                          className="text-kp-gray hover:text-kp-red px-2 py-2">✕</button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Total medios vs total a pagar */}
              <div className="flex items-center justify-between rounded-lg bg-kp-surface2 border border-kp-border px-4 py-2">
                <span className="text-xs uppercase tracking-widest text-kp-gray">Total medios</span>
                <div className="text-right">
                  <span className={`text-sm font-bold tabular-nums ${Math.abs(totalMedios - totalPago) <= 0.01 && totalPago > 0 ? 'text-green-400' : 'text-kp-red'}`}>
                    {fmt(totalMedios)}
                  </span>
                  {Math.abs(totalMedios - totalPago) > 0.01 && totalPago > 0 && (
                    <span className="block text-[11px] text-kp-red">
                      {totalMedios < totalPago ? `Faltan ${fmt(totalPago - totalMedios)}` : `Se pasan ${fmt(totalMedios - totalPago)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Observaciones</label>
              <input type="text" value={observaciones} onChange={e => setObs(e.target.value)}
                placeholder="Referencia, nº de transferencia, etc." className={inputCls} />
            </div>

            {/* Cheques */}
            {hayCheque && (
              <div className="space-y-3 pt-3 border-t border-kp-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Cheques ({cheques.length})</p>
                  <button type="button" onClick={addCheque}
                    className="flex items-center gap-1 text-xs font-semibold text-white bg-kp-red/90 hover:bg-kp-red transition-colors px-3 py-1.5 rounded-lg shadow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3.5 h-3.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Agregar cheque
                  </button>
                </div>

                {cheques.map((ch, i) => {
                  const restante = +(totalPago - cheques.reduce((s, c, j) => s + (j === i ? 0 : (parseFloat(c.importe) || 0)), 0)).toFixed(2);
                  return (
                    <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end rounded-lg border border-kp-border bg-kp-surface2/40 p-3">
                      <div className="sm:col-span-3"><label className={labelCls}>Banco</label>
                        <input type="text" value={ch.banco} placeholder="Banco" onChange={e => updCheque(i, 'banco', e.target.value)} className={inputCls} /></div>
                      <div className="sm:col-span-3"><label className={labelCls}>Nº Cheque</label>
                        <input type="text" value={ch.numero_cheque} placeholder="00000000" onChange={e => updCheque(i, 'numero_cheque', e.target.value)} className={inputCls} /></div>
                      <div className="sm:col-span-3"><label className={labelCls}>Fecha del cheque *</label>
                        <input type="date" value={ch.fecha_vencimiento} onChange={e => updCheque(i, 'fecha_vencimiento', e.target.value)} className={inputCls} /></div>
                      <div className="sm:col-span-3">
                        <div className="flex items-center justify-between">
                          <label className={labelCls}>Importe *</label>
                          {restante > 0 && (
                            <button type="button" onClick={() => updCheque(i, 'importe', String(restante))}
                              className="text-[10px] text-kp-red hover:underline mb-1">usar resto {fmt(restante)}</button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <NumericInput value={ch.importe} placeholder="0.00" onChange={e => updCheque(i, 'importe', e.target.value)} className={inputCls} />
                          <button type="button" onClick={() => delCheque(i)} title="Quitar cheque"
                            className="self-stretch px-2 text-kp-gray hover:text-kp-red">✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Total de cheques (define el importe del medio Cheque) */}
                <div className="flex items-center justify-between rounded-lg bg-kp-surface2 border border-kp-border px-4 py-2">
                  <span className="text-xs uppercase tracking-widest text-kp-gray">Total cheques</span>
                  <span className="text-sm font-bold tabular-nums text-kp-white">{fmt(totalCheques)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Resumen + confirmar ── */}
          <div className={`${cardCls} sticky bottom-2 shadow-2xl`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="block text-[11px] uppercase tracking-widest text-kp-gray">Total a pagar</span>
                  <span className="text-2xl font-bold tabular-nums text-kp-white">{fmt(totalPago)}</span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-widest text-kp-gray">Saldo resultante</span>
                  <span className="text-lg font-bold tabular-nums text-kp-gray-lt">{fmt(saldoProv - totalPago)}</span>
                </div>
              </div>
              <button onClick={submit} disabled={saving || totalPago <= 0}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? <><Spinner /> Registrando…</> : 'Registrar pago'}
              </button>
            </div>
            {error && <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>}
            {okMsg && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">{okMsg}</p>}
          </div>

          {/* ── Historial de pagos ── */}
          {historial.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-kp-gray-lt mb-2 pl-1">Últimos pagos a este proveedor</h3>
              <div className="rounded-xl border border-kp-border overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-kp-surface2 border-b border-kp-border">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Fecha</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Medio</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Detalle</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Monto</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kp-border">
                    {historial.map(h => (
                      <tr key={h.id} className={`bg-kp-surface ${h.anulado ? 'opacity-40 line-through' : ''}`}>
                        <td className="px-4 py-2 text-xs text-kp-gray whitespace-nowrap">{fmtFecha(h.fecha)}</td>
                        <td className="px-4 py-2 text-xs text-kp-gray-lt">{h.medio_pago_nombre}{h.sucursal_nombre ? ` · ${h.sucursal_nombre}` : ''}</td>
                        <td className="px-4 py-2 text-xs text-kp-gray-lt">
                          {parseInt(h.aplicaciones_count) > 0 ? `${h.aplicaciones_count} comprobante(s)` : 'Pago a cuenta'}
                          {h.observaciones ? ` — ${h.observaciones}` : ''}
                          {h.anulado ? ' · ANULADO' : ''}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-kp-white">{fmt(h.monto)}</td>
                        <td className="px-3 py-2 text-right">
                          {!h.anulado && (
                            <button onClick={() => { setAnularTarget(h); setMotivoAnular(''); setAnularError(null); }}
                              className="text-xs text-kp-gray hover:text-kp-red px-2 py-1 rounded border border-transparent hover:border-kp-red/40 hover:bg-kp-red/10 transition-colors">
                              Anular
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Registro global de pagos a proveedores (siempre visible) ── */}
      <div className="pt-2 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 bg-kp-red rounded-full block" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">Registro de pagos a proveedores</h3>
            <span className="text-xs text-kp-gray">({registroFiltrado.length})</span>
          </div>
          <input
            type="search"
            value={filtroRegistro}
            onChange={e => setFiltroRegistro(e.target.value)}
            placeholder="Buscar por proveedor, medio u observación…"
            className="w-full sm:w-80 bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors"
          />
        </div>

        <div className="rounded-xl border border-kp-border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest whitespace-nowrap">Fecha</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Proveedor</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Medio</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Detalle</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Monto</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {loadingTodos ? (
                <tr><td colSpan={6} className="text-center py-10 text-kp-gray"><div className="flex justify-center"><Spinner /></div></td></tr>
              ) : registroFiltrado.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-sm text-kp-gray">
                  {filtroRegistro ? 'No hay pagos que coincidan con la búsqueda.' : 'Todavía no se registraron pagos a proveedores.'}
                </td></tr>
              ) : registroFiltrado.map(h => (
                <tr key={h.id} className={`bg-kp-surface transition-colors hover:bg-kp-surface2 ${h.anulado ? 'opacity-40 line-through' : ''}`}>
                  <td className="px-4 py-2 text-xs text-kp-gray whitespace-nowrap">{fmtFecha(h.fecha)}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-kp-white">{h.proveedor_nombre ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-kp-gray-lt whitespace-nowrap">{h.medio_pago_nombre}{h.sucursal_nombre ? ` · ${h.sucursal_nombre}` : ''}</td>
                  <td className="px-4 py-2 text-xs text-kp-gray-lt max-w-[280px] truncate">
                    {parseInt(h.aplicaciones_count) > 0 ? `${h.aplicaciones_count} comprobante(s)` : 'Pago a cuenta'}
                    {h.observaciones ? ` — ${h.observaciones}` : ''}
                    {h.anulado ? ' · ANULADO' : ''}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-kp-white whitespace-nowrap">{fmt(h.monto)}</td>
                  <td className="px-3 py-2 text-right">
                    {!h.anulado && (
                      <button onClick={() => { setAnularTarget(h); setMotivoAnular(''); setAnularError(null); }}
                        className="text-xs text-kp-gray hover:text-kp-red px-2 py-1 rounded border border-transparent hover:border-kp-red/40 hover:bg-kp-red/10 transition-colors">
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal de anulación ── */}
      {anularTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !anulando) setAnularTarget(null); }}>
          <div className="w-full max-w-md bg-kp-surface border border-kp-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">Anular pago</h3>
              <button onClick={() => !anulando && setAnularTarget(null)} className="text-kp-gray hover:text-kp-white">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-kp-gray-lt">
                Vas a anular el pago de <span className="font-bold text-kp-white">{fmt(anularTarget.monto)}</span> del {fmtFecha(anularTarget.fecha)} ({anularTarget.medio_pago_nombre}).
              </p>
              <p className="text-xs text-amber-400/80">
                Se revertirá la cuenta corriente y el estado de los comprobantes imputados.
              </p>
              <div>
                <label className={labelCls}>Motivo *</label>
                <input type="text" value={motivoAnular} onChange={e => setMotivoAnular(e.target.value)}
                  placeholder="Ej: cargado por error" className={inputCls} autoFocus />
              </div>
              {anularError && <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{anularError}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setAnularTarget(null)} disabled={anulando}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={confirmarAnular} disabled={anulando}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
                  {anulando ? <><Spinner /> Anulando…</> : 'Anular pago'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
