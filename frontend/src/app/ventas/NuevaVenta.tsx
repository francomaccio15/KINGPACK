'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

// ─── Types ────────────────────────────────────────────────────────────────────

type Sucursal = { id: string; nombre: string };
type Lista    = { id: string; nombre: string; tipo: string; descuento_lista: number };

interface ArticuloResult {
  id: string;
  nombre: string;
  codigo: string;
  precio_madre: number;
  precio_lista: number; // resolved by backend when lista_id is passed
  stock_total: number;
  stock_bajo: boolean;
}

interface ClienteResult {
  id: string;
  razon_social: string;
  lista_precio_id: string | null;
  lista_precio: string | null;      // API field name
  descuento_adicional: number;
  saldo_actual: number;             // negativo = tiene saldo a favor
}

interface MedioPago {
  id: string;
  nombre: string;
}

interface CuentaBancaria {
  id: string;
  nombre: string;
  banco: string | null;
  titular: string | null;
  alias: string | null;
  cbu: string | null;
}

interface Cheque {
  banco: string;
  numero_cheque: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  importe: string;
}

interface CartItem {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  precio_lista: number;        // from API (with lista applied)
  precio_madre: number;        // fallback base price
  descuento_manual: number | null; // % fijado a mano para ESTE ítem (null = hereda lista/cliente)
  descuento_pct: number;       // descuento efectivo aplicado %
  precio_unitario_final: number;
  stock_disponible: number;    // stock al momento de agregar
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcCombinedDiscount(d1: number, d2: number): number {
  // 1 - (1 - d1/100) * (1 - d2/100), expressed as %
  const result = (1 - (1 - d1 / 100) * (1 - d2 / 100)) * 100;
  return Math.round(result * 100) / 100;
}

function calcFinalPrice(precioLista: number, discountPct: number): number {
  return precioLista * (1 - discountPct / 100);
}

function recalcItem(
  item: CartItem,
  descuentoLista: number,
  descuentoCliente: number,
): CartItem {
  // Precio de la lista ACTUAL = precio madre con el descuento de la lista aplicado
  // (todas las listas son un % sobre el madre). Se recalcula acá para que al
  // cambiar de lista o de cliente TODOS los ítems se re-precien de una.
  const precio_lista = calcFinalPrice(item.precio_madre, descuentoLista);
  // Descuento adicional (sobre el precio de lista): el manual del ítem, o el del
  // cliente si no hay manual. Es lo que se manda al backend como descuento_pct,
  // que lo aplica sobre el precio de lista (evita el doble descuento).
  const descuento_pct = item.descuento_manual != null
    ? item.descuento_manual
    : descuentoCliente;
  const precio_unitario_final = calcFinalPrice(precio_lista, descuento_pct);
  return { ...item, precio_lista, descuento_pct, precio_unitario_final };
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-kp-gray"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NuevaVenta({
  sucursales,
  listas,
}: {
  sucursales: Sucursal[];
  listas: Lista[];
}) {
  const router = useRouter();

  // ── Modal open state
  const [open, setOpen] = useState(false);

  // ── Sucursal
  const [sucursalId, setSucursalId] = useState<string>(sucursales[0]?.id ?? '');

  // ── Article search
  const [artQuery, setArtQuery]       = useState('');
  const [artResults, setArtResults]   = useState<ArticuloResult[]>([]);
  const [artLoading, setArtLoading]   = useState(false);
  const artDebounceRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Client
  const [clientMode, setClientMode]     = useState<'publico' | 'especifico'>('publico');
  const [clientQuery, setClientQuery]   = useState('');
  const [clientResults, setClientResults] = useState<ClienteResult[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClienteResult | null>(null);
  const clientDebounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientDropRef                   = useRef<HTMLDivElement>(null);

  // ── Lista de precios (default: Precio Base / lista madre)
  const listaBaseId = listas.find(l => l.tipo === 'madre')?.id ?? '';
  const [listaId, setListaId] = useState<string>(listaBaseId);

  // ── Descuentos
  const descuentoLista   = listas.find(l => l.id === listaId)?.descuento_lista ?? 0;
  const descuentoCliente = selectedClient?.descuento_adicional ?? 0;
  // Descuento base que heredan los ítems sin descuento manual propio.
  // Es SÓLO el descuento adicional del cliente: el descuento de la lista ya viene
  // aplicado en el precio de lista (precio_efectivo), no se suma de nuevo.
  const descuentoBase    = descuentoCliente;

  // ── Medios de pago
  const [mediosPago, setMediosPago]       = useState<MedioPago[]>([]);
  const [medioPagoId, setMedioPagoId]     = useState<string>('');
  const [cheques, setCheques]             = useState<Cheque[]>([{ banco: '', numero_cheque: '', fecha_emision: '', fecha_vencimiento: '', importe: '' }]);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [cuentaDestinoId, setCuentaDestinoId]   = useState<string>('');
  const [cuentaDestinoId2, setCuentaDestinoId2] = useState<string>('');

  // ── Pago dividido (2 medios)
  const [usarSegundoMedio, setUsarSegundoMedio] = useState(false);
  const [medioPagoId2, setMedioPagoId2]         = useState<string>('');
  const [monto1Str, setMonto1Str]               = useState<string>('');

  const selectedMedio  = mediosPago.find(m => m.id === medioPagoId);
  const selectedMedio2 = mediosPago.find(m => m.id === medioPagoId2);
  const esCheque       = selectedMedio?.nombre.toLowerCase().includes('cheque') ?? false;
  const esCheque2      = selectedMedio2?.nombre.toLowerCase().includes('cheque') ?? false;
  const esTransferencia = selectedMedio
    ? ['transferencia', 'mercado pago', 'qr'].some(k => selectedMedio.nombre.toLowerCase().includes(k))
    : false;
  const esTransferencia2 = selectedMedio2
    ? ['transferencia', 'mercado pago', 'qr'].some(k => selectedMedio2.nombre.toLowerCase().includes(k))
    : false;
  const esEfectivo = selectedMedio?.nombre.toLowerCase().includes('efectivo') ?? false;

  // ── Efectivo: importe recibido y vuelto
  const [montoRecibido, setMontoRecibido] = useState<string>('');

  // ── Saldo a favor
  const [saldoAFavorAplicado, setSaldoAFavorAplicado] = useState<number>(0);

  // Cuánto saldo a favor tiene el cliente (solo si saldo_actual < 0)
  const saldoAFavorDisponible = selectedClient && (selectedClient.saldo_actual ?? 0) < 0
    ? Math.abs(selectedClient.saldo_actual ?? 0)
    : 0;

  // ID del medio de pago "Saldo a favor" (insertado en la DB)
  const SALDO_FAVOR_MP_ID = 'b1122bd5-2aac-4b21-bbc0-739729681c1e';

  // ── Caja state
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null); // null = checking

  // ── Save state
  const [saving, setSaving]     = useState<'preventa' | 'confirmada' | null>(null);
  const [saveError, setSaveError] = useState('');

  // ─── Fetch medios de pago + cuentas bancarias + estado caja when modal opens ─
  useEffect(() => {
    if (!open) return;
    apiFetch(`/api/ventas/medios-pago`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const list: MedioPago[] = data.medios_pago ?? data ?? [];
        setMediosPago(list);
        setMedioPagoId(list[0]?.id ?? '');
        setMedioPagoId2(list[1]?.id ?? list[0]?.id ?? '');
      })
      .catch(() => {});
    apiFetch(`/api/cuentas-bancarias`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const cuentas: CuentaBancaria[] = data.cuentas ?? [];
        setCuentasBancarias(cuentas);
        setCuentaDestinoId(cuentas[0]?.id ?? '');
      })
      .catch(() => {});
  }, [open]);

  // ─── Verificar caja abierta cuando cambia sucursal o se abre el modal ────────
  useEffect(() => {
    if (!open || !sucursalId) return;
    setCajaAbierta(null);
    apiFetch(`/api/caja?sucursal_id=${sucursalId}&estado=abierta&limit=1`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const cajas: any[] = data.cajas ?? [];
        setCajaAbierta(cajas.length > 0);
      })
      .catch(() => setCajaAbierta(true)); // en caso de error, no bloquear
  }, [open, sucursalId]);

  // ─── Reset when closed ─────────────────────────────────────────────────────
  const resetModal = useCallback(() => {
    setArtQuery('');
    setArtResults([]);
    setCart([]);
    setClientMode('publico');
    setClientQuery('');
    setClientResults([]);
    setClientDropOpen(false);
    setSelectedClient(null);
    setListaId(listaBaseId);
    setSaveError('');
    setSaving(null);
    setSucursalId(sucursales[0]?.id ?? '');
    setSaldoAFavorAplicado(0);
    setMontoRecibido('');
    setUsarSegundoMedio(false);
    setMonto1Str('');
    setCajaAbierta(null);
  }, [sucursales]);

  const cerrar = useCallback(() => {
    setOpen(false);
    resetModal();
  }, [resetModal]);

  // ─── Article search (debounced 300 ms) ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (artDebounceRef.current) clearTimeout(artDebounceRef.current);

    if (!artQuery.trim()) {
      setArtResults([]);
      setArtLoading(false);
      return;
    }

    setArtLoading(true);
    artDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: artQuery.trim(), limit: '30' });
        if (listaId)    params.set('lista_id',    listaId);
        if (sucursalId) params.set('sucursal_id', sucursalId);
        const r = await apiFetch(`/api/articulos?${params}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setArtResults(data.articulos ?? data ?? []);
      } catch {
        setArtResults([]);
      } finally {
        setArtLoading(false);
      }
    }, 300);

    return () => { if (artDebounceRef.current) clearTimeout(artDebounceRef.current); };
  }, [artQuery, listaId, sucursalId, open]);

  // ─── Client search (debounced 300 ms) ────────────────────────────────────
  useEffect(() => {
    if (clientMode !== 'especifico') return;
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);

    if (!clientQuery.trim()) {
      setClientResults([]);
      setClientLoading(false);
      return;
    }

    setClientLoading(true);
    clientDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: clientQuery.trim(), limit: '20' });
        const r = await apiFetch(`/api/clientes?${params}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setClientResults(data.clientes ?? data ?? []);
        setClientDropOpen(true);
      } catch {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 300);

    return () => { if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current); };
  }, [clientQuery, clientMode]);

  // ─── Close client dropdown on outside click ────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientDropRef.current && !clientDropRef.current.contains(e.target as Node)) {
        setClientDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Auto-select client list when client is chosen ─────────────────────────
  useEffect(() => {
    if (selectedClient?.lista_precio_id) {
      setListaId(selectedClient.lista_precio_id);
    }
    // Reset saldo a favor al cambiar cliente
    setSaldoAFavorAplicado(0);
  }, [selectedClient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Recalculate cart when lista or client discount changes ───────────────
  useEffect(() => {
    setCart(prev =>
      prev.map(item => recalcItem(item, descuentoLista, descuentoCliente))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaId, selectedClient?.id]);

  // ─── Add article to cart ───────────────────────────────────────────────────
  const addToCart = useCallback((art: ArticuloResult) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.articulo_id === art.id);
      if (existing !== -1) {
        return prev.map((item, idx) =>
          idx === existing
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      // precio_madre = nuestro precio base real. El precio de lista se calcula como
      // madre con el descuento de la lista (todas las listas son % sobre el madre),
      // y sobre eso el descuento adicional del cliente. Así, si después se cambia la
      // lista o el cliente, recalcItem re-precia el ítem con el descuento correcto.
      const madre        = art.precio_madre ?? art.precio_lista ?? 0;
      const precio_lista = calcFinalPrice(madre, descuentoLista);
      const descuento    = descuentoCliente;
      const finalPrice   = calcFinalPrice(precio_lista, descuento);
      return [
        ...prev,
        {
          articulo_id:           art.id,
          nombre:                art.nombre,
          codigo:                art.codigo,
          cantidad:              1,
          precio_lista:          precio_lista,
          precio_madre:          madre,
          descuento_manual:      null,
          descuento_pct:         descuento,
          precio_unitario_final: finalPrice,
          stock_disponible:      art.stock_total ?? 0,
        },
      ];
    });
  }, [descuentoCliente, descuentoLista]);

  // ─── Descuento manual por ítem ─────────────────────────────────────────────
  // Vacío = el ítem vuelve a heredar el descuento de lista/cliente.
  const setDescuentoItem = useCallback((articuloId: string, raw: string) => {
    let manual: number | null;
    if (raw.trim() === '') {
      manual = null;
    } else {
      const v = parseFloat(raw.replace(',', '.'));
      manual = isNaN(v) ? null : Math.min(100, Math.max(0, v));
    }
    setCart(prev =>
      prev.map(item =>
        item.articulo_id === articuloId
          ? recalcItem({ ...item, descuento_manual: manual }, descuentoLista, descuentoCliente)
          : item
      )
    );
  }, [descuentoLista, descuentoCliente]);

  // ─── Update quantity ───────────────────────────────────────────────────────
  const updateQty = useCallback((articuloId: string, delta: number) => {
    setCart(prev =>
      prev.map(item =>
        item.articulo_id === articuloId
          ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }
          : item
      )
    );
  }, []);

  const setQty = useCallback((articuloId: string, raw: string) => {
    const val = parseInt(raw, 10);
    if (isNaN(val) || raw === '') {
      // Permite borrar el campo temporalmente (lo guardamos como string vacío via trick)
      setCart(prev =>
        prev.map(item =>
          item.articulo_id === articuloId ? { ...item, cantidad: 0 } : item
        )
      );
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.articulo_id === articuloId
          ? { ...item, cantidad: Math.max(1, val) }
          : item
      )
    );
  }, []);

  const commitQty = useCallback((articuloId: string) => {
    setCart(prev =>
      prev.map(item =>
        item.articulo_id === articuloId
          ? { ...item, cantidad: Math.max(1, item.cantidad || 1) }
          : item
      )
    );
  }, []);

  // ─── Remove from cart ──────────────────────────────────────────────────────
  const removeFromCart = useCallback((articuloId: string) => {
    setCart(prev => prev.filter(i => i.articulo_id !== articuloId));
  }, []);

  // ─── Totals ────────────────────────────────────────────────────────────────
  const subtotalBruto = cart.reduce(
    (acc, i) => acc + i.precio_madre * i.cantidad, 0
  );
  const subtotalFinal = cart.reduce(
    (acc, i) => acc + i.precio_unitario_final * i.cantidad, 0
  );
  const descuentoTotal = subtotalBruto - subtotalFinal;

  // ─── Vuelto ────────────────────────────────────────────────────────────────
  const totalAPagar      = Math.max(0, subtotalFinal - Math.min(saldoAFavorAplicado, subtotalFinal));
  const montoRecibidoNum = parseFloat(montoRecibido.replace(',', '.')) || 0;
  const vuelto           = esEfectivo && montoRecibidoNum > 0
    ? montoRecibidoNum - totalAPagar
    : 0;

  // ── Pago dividido
  const monto1Num = Math.min(totalAPagar, Math.max(0, parseFloat(monto1Str.replace(',', '.')) || 0));
  const monto2Num = Math.max(0, totalAPagar - monto1Num);

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (estado: 'preventa' | 'confirmada') => {
    if (cart.length === 0) return;
    setSaveError('');
    setSaving(estado);

    // ── Construir pagos (saldo a favor + medio restante) ─────────────────────
    const saldoAplicado = Math.min(saldoAFavorAplicado, subtotalFinal);
    const saldoRestante = Math.max(0, subtotalFinal - saldoAplicado);

    const pagos: {
      medio_pago_id: string;
      monto: number;
      cuenta_destino?: string | null;
      cheques?: object[];
    }[] = [];

    if (saldoAplicado > 0.001) {
      pagos.push({ medio_pago_id: SALDO_FAVOR_MP_ID, monto: saldoAplicado });
    }

    if (usarSegundoMedio) {
      // Pago dividido: dos medios con montos explícitos
      const chequesValidos = cheques
        .filter(c => c.banco && c.numero_cheque && c.fecha_vencimiento && c.importe)
        .map(c => ({ ...c, importe: parseFloat(c.importe) }));
      if (monto1Num > 0.001 && medioPagoId) {
        pagos.push({
          medio_pago_id: medioPagoId,
          monto: monto1Num,
          cuenta_destino: esTransferencia ? (cuentasBancarias.find(c => c.id === cuentaDestinoId)?.nombre ?? null) : null,
          cheques: esCheque ? chequesValidos : undefined,
        });
      }
      if (monto2Num > 0.001 && medioPagoId2) {
        pagos.push({
          medio_pago_id: medioPagoId2,
          monto: monto2Num,
          cuenta_destino: esTransferencia2 ? (cuentasBancarias.find(c => c.id === cuentaDestinoId2)?.nombre ?? null) : null,
          cheques: esCheque2 ? chequesValidos : undefined,
        });
      }
    } else if (saldoRestante > 0.001 && medioPagoId) {
      pagos.push({
        medio_pago_id:  medioPagoId,
        monto:          saldoRestante,
        cuenta_destino: esTransferencia
          ? (cuentasBancarias.find(c => c.id === cuentaDestinoId)?.nombre ?? null)
          : null,
        cheques: esCheque
          ? cheques.filter(c => c.banco && c.numero_cheque && c.fecha_vencimiento && c.importe)
                   .map(c => ({ ...c, importe: parseFloat(c.importe) }))
          : undefined,
      });
    }

    const body = {
      sucursal_id:    sucursalId || null,
      cliente_id:     selectedClient?.id ?? null,
      lista_precio_id: listaId || null,
      estado,
      observaciones:  null,
      items: cart.map(i => ({
        articulo_id:           i.articulo_id,
        cantidad:              i.cantidad,
        precio_lista:          i.precio_lista,
        descuento_pct:         i.descuento_pct,
        precio_unitario_final: i.precio_unitario_final,
        iva_monto:             0,
      })),
      pagos,
    };

    try {
      const r = await apiFetch(`/api/ventas`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        let msg = data.error ?? 'Error al guardar la venta';
        if (data.detalle?.disponible !== undefined) {
          msg += ` — disponible: ${data.detalle.disponible}, pedido: ${data.detalle.solicitado}`;
        }
        throw new Error(msg);
      }
      cerrar();
      router.refresh();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const cartEmpty = cart.length === 0;

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
          bg-kp-red hover:bg-kp-red-dark transition-colors text-white text-sm font-semibold
          shadow-lg shadow-kp-red/20"
      >
        <span className="text-base leading-none font-bold">+</span>
        Nueva Venta
      </button>

      {/* ── Full-screen modal ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Nueva Venta"
        >
          <div className="max-w-7xl w-full mx-4 h-[90vh] bg-kp-surface border border-kp-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-6 bg-kp-red rounded-full block shrink-0" />
                  <h2 className="font-bold text-base uppercase tracking-wide text-kp-white">
                    Nueva Venta
                  </h2>
                </div>

                {/* Sucursal selector in header */}
                {sucursales.length > 0 ? (
                  <select
                    value={sucursalId}
                    onChange={e => setSucursalId(e.target.value)}
                    className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5 text-xs text-kp-gray-lt
                      focus:outline-none focus:border-kp-red transition-colors"
                    aria-label="Sucursal"
                  >
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-kp-gray bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5">
                    Sin sucursales
                  </span>
                )}
              </div>

              <button
                onClick={cerrar}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-kp-gray
                  hover:text-kp-white hover:bg-kp-surface2 transition-colors text-lg leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* ── Body: two panels ───────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

              {/* ══ LEFT PANEL — Artículos + Carrito ══════════════════════ */}
              <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4">

                {/* Caja cerrada — panel bloqueante */}
                {cajaAbierta === false && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                    <div className="w-16 h-16 rounded-2xl bg-kp-red/10 border border-kp-red/30 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-8 h-8 text-kp-red">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-kp-white mb-1">Caja cerrada</p>
                      <p className="text-sm text-kp-gray">No se pueden registrar ventas.<br/>Primero abrí la caja de esta sucursal.</p>
                    </div>
                  </div>
                )}

                {/* Verificando estado de caja */}
                {cajaAbierta === null && (
                  <div className="flex-1 flex items-center justify-center">
                    <Spinner />
                  </div>
                )}

                {/* Contenido normal solo si caja abierta */}
                {cajaAbierta === true && (
                  <>
                {/* Article search */}
                <div>
                  <label className="block text-[10px] text-kp-gray uppercase tracking-widest mb-1.5">
                    Buscar artículo
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={artQuery}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setArtQuery(e.target.value)}
                      placeholder="Nombre o código de producto…"
                      className="bg-kp-surface2 border border-kp-border focus:border-kp-red rounded-lg px-3 py-2 text-sm w-full text-kp-white placeholder:text-kp-gray outline-none transition-colors pr-8"
                      autoComplete="off"
                    />
                    {artLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner />
                      </span>
                    )}
                  </div>
                </div>

                {/* Search results */}
                {artResults.length > 0 && (
                  <div className="border border-kp-border rounded-xl overflow-hidden shrink-0 max-h-56 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-kp-surface2 border-b border-kp-border">
                      <span className="text-[10px] text-kp-gray uppercase tracking-widest">
                        Resultados ({artResults.length})
                      </span>
                    </div>
                    {artResults.map(art => {
                      const displayPrice = art.precio_lista ?? art.precio_madre;
                      const sinStock   = art.stock_total === 0;
                      const stockBadge = sinStock
                        ? { cls: 'bg-rose-500/15 text-rose-400 border-rose-500/20',  label: 'Sin stock' }
                        : art.stock_bajo
                          ? { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20', label: `Stock: ${Number(art.stock_total).toLocaleString('es-AR')}` }
                          : { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', label: `Stock: ${Number(art.stock_total).toLocaleString('es-AR')}` };
                      return (
                        <div
                          key={art.id}
                          className="flex items-center gap-3 px-3 py-2.5 border-b border-kp-border last:border-0
                            hover:bg-kp-surface2 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-kp-white truncate">{art.nombre}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-kp-gray">{art.codigo}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${stockBadge.cls}`}>
                                {stockBadge.label}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-kp-white tabular-nums">
                              {ars.format(displayPrice)}
                            </p>
                            {listaId && art.precio_lista !== art.precio_madre && (
                              <p className="text-[10px] text-kp-gray line-through tabular-nums">
                                {ars.format(art.precio_madre)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => addToCart(art)}
                            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg
                              border border-kp-red text-kp-red hover:bg-kp-red hover:text-white
                              transition-colors"
                          >
                            + Agregar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {artQuery.trim() && !artLoading && artResults.length === 0 && (
                  <p className="text-xs text-kp-gray text-center py-3">
                    Sin resultados para &ldquo;{artQuery}&rdquo;
                  </p>
                )}

                {/* Cart section header */}
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-kp-gray uppercase tracking-widest">
                    Carrito
                  </span>
                  {cart.length > 0 && (
                    <span className="text-[10px] text-kp-gray">
                      {cart.reduce((acc, i) => acc + i.cantidad, 0)} unidades
                    </span>
                  )}
                </div>

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto -mr-1 pr-1">
                  {cartEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
                      <div className="w-14 h-14 rounded-2xl bg-kp-surface2 border border-kp-border
                        flex items-center justify-center text-2xl text-kp-gray">
                        🛒
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-kp-gray">Carrito vacío</p>
                        <p className="text-xs text-kp-gray/60 mt-0.5">
                          Buscá artículos para agregar
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {cart.map((item, idx) => {
                        // Descuento efectivo respecto al precio madre (lista + adicional),
                        // para que se vea el descuento de lista aunque no haya adicional.
                        const descEfectivo = item.precio_madre > 0
                          ? (1 - item.precio_unitario_final / item.precio_madre) * 100
                          : 0;
                        const hasDiscount = descEfectivo > 0.05;
                        const subtotalLine = item.precio_unitario_final * item.cantidad;
                        return (
                          <div
                            key={item.articulo_id}
                            className={`relative flex items-center gap-2 py-2.5 ${
                              idx < cart.length - 1 ? 'border-b border-kp-border' : ''
                            }`}
                          >
                            {/* Article info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-kp-white truncate leading-tight">
                                {item.nombre}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-kp-gray">{item.codigo}</span>
                                {hasDiscount && (
                                  <>
                                    <span className="text-[10px] text-kp-gray line-through tabular-nums">
                                      {ars.format(item.precio_madre)}
                                    </span>
                                    <span className="text-[10px] font-semibold text-kp-red bg-kp-red/10
                                      border border-kp-red/20 rounded px-1 py-0.5 leading-none">
                                      -{descEfectivo.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] text-kp-white tabular-nums">
                                      {ars.format(item.precio_unitario_final)}
                                    </span>
                                  </>
                                )}
                                {!hasDiscount && (
                                  <span className="text-[10px] text-kp-gray tabular-nums">
                                    {ars.format(item.precio_unitario_final)} c/u
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Qty controls */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => updateQty(item.articulo_id, -1)}
                                className="w-7 h-7 rounded-l border border-kp-border text-kp-gray hover:text-kp-white
                                  hover:bg-kp-surface2 flex items-center justify-center text-sm leading-none
                                  transition-colors"
                                aria-label="Reducir cantidad"
                              >
                                −
                              </button>
                              <NumericInput
                                decimals={0}
                                value={item.cantidad === 0 ? '' : item.cantidad}
                                onChange={e => setQty(item.articulo_id, e.target.value)}
                                onBlur={() => commitQty(item.articulo_id)}
                                className={[
                                  'w-14 text-center text-sm font-semibold tabular-nums',
                                  'bg-kp-surface2 border-y border-kp-border outline-none py-1',
                                  'focus:border-kp-red focus:bg-kp-surface transition-colors',
                                  item.stock_disponible > 0 && item.cantidad > item.stock_disponible
                                    ? 'text-amber-400'
                                    : 'text-kp-white',
                                ].join(' ')}
                                aria-label="Cantidad"
                              />
                              <button
                                onClick={() => updateQty(item.articulo_id, 1)}
                                className="w-7 h-7 rounded-r border border-kp-border text-kp-gray hover:text-kp-white
                                  hover:bg-kp-surface2 flex items-center justify-center text-sm leading-none
                                  transition-colors"
                                aria-label="Aumentar cantidad"
                              >
                                +
                              </button>
                            </div>
                            {/* Aviso stock insuficiente inline */}
                            {item.stock_disponible > 0 && item.cantidad > item.stock_disponible && (
                              <span className="text-[9px] text-amber-400 font-semibold absolute -bottom-3.5 right-10 whitespace-nowrap">
                                Stock: {item.stock_disponible}
                              </span>
                            )}

                            {/* Descuento por ítem */}
                            <div className="flex items-center shrink-0" title="Descuento de este artículo (%)">
                              <NumericInput
                                decimals={1}
                                placeholder={descuentoBase > 0 ? String(descuentoBase) : '0'}
                                value={item.descuento_manual != null ? item.descuento_manual : ''}
                                onChange={e => setDescuentoItem(item.articulo_id, e.target.value)}
                                className={[
                                  'w-12 text-center text-xs tabular-nums py-1 outline-none rounded-l',
                                  'bg-kp-surface2 border border-kp-border focus:border-kp-red focus:bg-kp-surface transition-colors',
                                  item.descuento_pct > 0 ? 'text-kp-red font-semibold' : 'text-kp-white',
                                ].join(' ')}
                                aria-label={`Descuento de ${item.nombre}`}
                              />
                              <span className="px-1.5 py-1 text-xs text-kp-gray bg-kp-surface2 border border-l-0 border-kp-border rounded-r leading-none">
                                %
                              </span>
                            </div>

                            {/* Line subtotal */}
                            <div className="w-24 text-right shrink-0">
                              <span className="text-sm font-semibold text-kp-white tabular-nums">
                                {ars.format(subtotalLine)}
                              </span>
                            </div>

                            {/* Remove button */}
                            <button
                              onClick={() => removeFromCart(item.articulo_id)}
                              className="w-7 h-7 flex items-center justify-center rounded text-kp-gray
                                hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                              aria-label={`Eliminar ${item.nombre}`}
                              title="Quitar artículo"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>

              {/* ══ RIGHT PANEL — Resumen ════════════════════════════════ */}
              <div className="w-80 shrink-0 border-l border-kp-border bg-kp-surface2 flex flex-col overflow-hidden">

                {/* Banner cliente seleccionado — siempre visible aunque scrollees */}
                {selectedClient && (
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-kp-surface border-b border-kp-border">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-amber-400 flex-shrink-0">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span className="text-xs font-semibold text-amber-400 truncate">{selectedClient.razon_social}</span>
                    {descuentoCliente > 0 && (
                      <span className="ml-auto text-xs text-kp-red font-bold flex-shrink-0">−{descuentoCliente}%</span>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                  {/* ── Cliente ─────────────────────────────────────────── */}
                  <section>
                    <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-2.5">
                      Cliente
                    </p>

                    {/* Radio toggle */}
                    <div className="flex rounded-lg border border-kp-border overflow-hidden mb-3">
                      {(['publico', 'especifico'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => {
                            setClientMode(mode);
                            if (mode === 'publico') {
                              setSelectedClient(null);
                              setClientQuery('');
                              setClientResults([]);
                              setClientDropOpen(false);
                            }
                          }}
                          className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                            clientMode === mode
                              ? 'bg-kp-red text-white'
                              : 'text-kp-gray hover:text-kp-white hover:bg-kp-surface'
                          }`}
                        >
                          {mode === 'publico' ? 'Público General' : 'Cliente Específico'}
                        </button>
                      ))}
                    </div>

                    {/* Client search */}
                    {clientMode === 'especifico' && (
                      <div className="relative" ref={clientDropRef}>
                        <div className="relative">
                          <input
                            type="text"
                            value={clientQuery}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              setClientQuery(e.target.value);
                              setSelectedClient(null);
                            }}
                            placeholder="Buscar cliente…"
                            className="bg-kp-surface border border-kp-border focus:border-kp-red rounded-lg
                              px-3 py-2 text-sm w-full text-kp-white placeholder:text-kp-gray
                              outline-none transition-colors pr-8"
                            autoComplete="off"
                          />
                          {clientLoading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Spinner />
                            </span>
                          )}
                        </div>

                        {/* Dropdown */}
                        {clientDropOpen && clientResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-10
                            bg-kp-surface border border-kp-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                            {clientResults.map(cli => (
                              <button
                                key={cli.id}
                                onClick={() => {
                                  setSelectedClient(cli);
                                  setClientQuery(cli.razon_social);
                                  setClientDropOpen(false);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-kp-surface2 transition-colors border-b border-kp-border last:border-0"
                              >
                                <p className="text-sm text-kp-white font-medium truncate">
                                  {cli.razon_social}
                                </p>
                                {cli.lista_precio && (
                                  <p className="text-[10px] text-kp-gray mt-0.5">
                                    Lista: {cli.lista_precio}
                                    {cli.descuento_adicional > 0 && ` · Dto. ${cli.descuento_adicional}%`}
                                  </p>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {clientQuery.trim() && !clientLoading && clientResults.length === 0 && (
                          <p className="text-xs text-kp-gray mt-1.5 px-1">
                            Sin resultados
                          </p>
                        )}

                        {/* Selected client info card */}
                        {selectedClient && (
                          <div className="mt-2 rounded-lg bg-kp-surface border border-kp-border px-3 py-2.5">
                            <p className="text-xs font-semibold text-kp-white truncate">
                              {selectedClient.razon_social}
                            </p>
                            {selectedClient.lista_precio && (
                              <p className="text-[10px] text-kp-gray mt-0.5">
                                Lista: {selectedClient.lista_precio}
                              </p>
                            )}
                            {selectedClient.descuento_adicional > 0 && (
                              <p className="text-[10px] text-kp-red font-semibold mt-0.5">
                                Dto. adicional: {selectedClient.descuento_adicional}%
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* ── Lista de precios ────────────────────────────────── */}
                  <section>
                    <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-2">
                      Lista de precios
                    </p>
                    <select
                      value={listaId}
                      onChange={e => setListaId(e.target.value)}
                      className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                        focus:outline-none focus:border-kp-red transition-colors"
                    >
                      {listas.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.nombre}{l.descuento_lista > 0 ? ` (${l.descuento_lista}% dto.)` : ''}
                        </option>
                      ))}
                    </select>
                  </section>

                  {/* ── Discount breakdown ──────────────────────────────── */}
                  {(descuentoLista > 0 || descuentoCliente > 0) && (
                    <section className="rounded-lg bg-kp-surface border border-kp-border px-3 py-2.5 space-y-1.5">
                      <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">
                        Descuentos aplicados
                      </p>
                      {descuentoLista > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-kp-gray">Lista de precios</span>
                          <span className="text-xs text-kp-red font-semibold">−{descuentoLista}%</span>
                        </div>
                      )}
                      {descuentoCliente > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs text-kp-gray">Dto. adicional</span>
                            {selectedClient && (
                              <span className="text-[10px] text-amber-400 font-semibold truncate max-w-[130px]">
                                {selectedClient.razon_social}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-kp-red font-semibold">−{descuentoCliente}%</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-kp-border">
                        <span className="text-xs font-semibold text-kp-white">Total descuento</span>
                        <span className="text-xs text-kp-red font-bold">
                          −{calcCombinedDiscount(descuentoLista, descuentoCliente).toFixed(2)}%
                        </span>
                      </div>
                    </section>
                  )}

                  {/* ── Saldo a favor ────────────────────────────────────── */}
                  {saldoAFavorDisponible > 0 && !cartEmpty && (
                    <section className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-3 space-y-2.5">
                      <div className="flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0">
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                          <path d="M9 12l2 2 4-4"/>
                        </svg>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                          Saldo a favor
                        </p>
                      </div>
                      <p className="text-lg font-bold text-emerald-400 tabular-nums leading-none">
                        {ars.format(saldoAFavorDisponible)}
                      </p>
                      <div>
                        <p className="text-[10px] text-kp-gray mb-1.5">Aplicar en esta venta</p>
                        <div className="flex gap-2">
                          <NumericInput
                            value={saldoAFavorAplicado || ''}
                            onChange={e => {
                              const max = Math.min(saldoAFavorDisponible, subtotalFinal);
                              const val = Math.min(max, Math.max(0, parseFloat(e.target.value) || 0));
                              setSaldoAFavorAplicado(val);
                            }}
                            placeholder="0,00"
                            className="flex-1 bg-kp-surface border border-emerald-500/40 rounded-lg px-3 py-2 text-sm
                              text-emerald-400 font-bold tabular-nums focus:outline-none focus:border-emerald-400 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setSaldoAFavorAplicado(Math.min(saldoAFavorDisponible, subtotalFinal))}
                            className="text-[10px] font-bold text-emerald-400 border border-emerald-500/40 rounded-lg
                              px-2 py-1 hover:bg-emerald-500/15 transition-colors whitespace-nowrap"
                          >
                            Todo
                          </button>
                        </div>
                      </div>
                      {saldoAFavorAplicado > 0 && (
                        <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20">
                          <span className="text-[10px] text-kp-gray">Resto a pagar</span>
                          <span className="text-sm font-bold text-kp-white tabular-nums">
                            {ars.format(Math.max(0, subtotalFinal - saldoAFavorAplicado))}
                          </span>
                        </div>
                      )}
                    </section>
                  )}

                  {/* ── Medio de pago ────────────────────────────────────── */}
                  {(saldoAFavorAplicado < subtotalFinal - 0.001 || cartEmpty) && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-kp-gray uppercase tracking-widest">
                          {saldoAFavorAplicado > 0 ? 'Medio de pago (resto)' : 'Medio de pago'}
                        </p>
                        {mediosPago.length >= 1 && (
                          <button
                            type="button"
                            onClick={() => { setUsarSegundoMedio(v => !v); setMonto1Str(''); setCuentaDestinoId2(''); }}
                            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${
                              usarSegundoMedio
                                ? 'bg-kp-red/10 border-kp-red/40 text-kp-red'
                                : 'border-kp-border text-kp-gray hover:border-kp-gray hover:text-kp-white'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Dividir pago
                          </button>
                        )}
                      </div>

                      {!usarSegundoMedio ? (
                        mediosPago.length > 0 ? (
                          <select
                            value={medioPagoId}
                            onChange={e => setMedioPagoId(e.target.value)}
                            className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                              focus:outline-none focus:border-kp-red transition-colors"
                          >
                            {mediosPago.filter(m => m.id !== SALDO_FAVOR_MP_ID).map(m => (
                              <option key={m.id} value={m.id}>{m.nombre}</option>
                            ))}
                          </select>
                        ) : (
                          <select className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-gray focus:outline-none transition-colors" disabled>
                            <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option>
                          </select>
                        )
                      ) : (
                        <div className="rounded-xl border border-kp-border overflow-hidden">
                          {/* Medio 1 */}
                          <div className="p-3 space-y-2 border-b border-kp-border">
                            <p className="text-[10px] text-kp-gray uppercase tracking-widest font-semibold">Medio 1</p>
                            <select
                              value={medioPagoId}
                              onChange={e => setMedioPagoId(e.target.value)}
                              className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors"
                            >
                              {mediosPago.filter(m => m.id !== SALDO_FAVOR_MP_ID).map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                              ))}
                            </select>
                            <div>
                              <p className="text-[10px] text-kp-gray mb-1">Monto</p>
                              <NumericInput
                                value={monto1Str}
                                onChange={e => setMonto1Str(e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm font-bold text-kp-white tabular-nums focus:outline-none focus:border-kp-red transition-colors"
                              />
                            </div>
                          </div>
                          {/* Medio 2 */}
                          <div className="p-3 space-y-2 bg-kp-surface2/30">
                            <p className="text-[10px] text-kp-gray uppercase tracking-widest font-semibold">Medio 2</p>
                            <select
                              value={medioPagoId2}
                              onChange={e => setMedioPagoId2(e.target.value)}
                              className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors"
                            >
                              {mediosPago.filter(m => m.id !== SALDO_FAVOR_MP_ID).map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                              ))}
                            </select>
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-kp-surface border border-kp-border">
                              <span className="text-xs text-kp-gray">Resto automático</span>
                              <span className="text-sm font-bold tabular-nums text-kp-white">
                                {ars.format(monto2Num)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* ── Efectivo: importe recibido + vuelto ─────────────── */}
                  {esEfectivo && !cartEmpty && !usarSegundoMedio && saldoAFavorAplicado < subtotalFinal - 0.001 && (
                    <section className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
                      <div className="px-4 py-2.5 bg-kp-surface2 border-b border-kp-border">
                        <p className="text-[10px] text-kp-gray uppercase tracking-widest">Efectivo</p>
                      </div>
                      <div className="px-4 py-3 space-y-3">
                        {/* Importe recibido */}
                        <div>
                          <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1.5">
                            Importe recibido
                          </p>
                          <NumericInput
                            value={montoRecibido}
                            onChange={e => setMontoRecibido(e.target.value)}
                            placeholder={ars.format(totalAPagar).replace('$ ', '')}
                            className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2.5
                              text-sm font-bold text-kp-white tabular-nums
                              focus:outline-none focus:border-kp-red transition-colors"
                          />
                        </div>

                        {/* Vuelto */}
                        {montoRecibidoNum > 0 && (
                          <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                            vuelto < 0
                              ? 'bg-kp-red/10 border border-kp-red/30'
                              : 'bg-emerald-500/10 border border-emerald-500/25'
                          }`}>
                            <span className={`text-xs font-semibold uppercase tracking-wide ${
                              vuelto < 0 ? 'text-kp-red' : 'text-emerald-400'
                            }`}>
                              {vuelto < 0 ? 'Falta' : 'Vuelto'}
                            </span>
                            <span className={`text-lg font-black tabular-nums ${
                              vuelto < 0 ? 'text-kp-red' : 'text-emerald-400'
                            }`}>
                              {ars.format(Math.abs(vuelto))}
                            </span>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* ── Cuenta destino (Transferencia / MP / QR) ─────────── */}
                  {esTransferencia && cuentasBancarias.length > 0 && saldoAFavorAplicado < subtotalFinal - 0.001 && (
                    <section>
                      <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-2">
                        Cuenta destino
                      </p>
                      <select
                        value={cuentaDestinoId}
                        onChange={e => setCuentaDestinoId(e.target.value)}
                        className="w-full bg-kp-surface border border-kp-red/60 rounded-lg px-3 py-2 text-sm text-kp-white
                          focus:outline-none focus:border-kp-red transition-colors"
                      >
                        {cuentasBancarias.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}{c.alias ? ` · ${c.alias}` : ''}
                          </option>
                        ))}
                      </select>
                      {/* Info de la cuenta seleccionada */}
                      {(() => {
                        const cc = cuentasBancarias.find(c => c.id === cuentaDestinoId);
                        return cc ? (
                          <div className="mt-1.5 px-3 py-2 bg-kp-surface2 rounded-lg border border-kp-border text-[11px] text-kp-gray space-y-0.5">
                            {cc.titular && <p><span className="text-kp-gray-lt font-medium">Titular:</span> {cc.titular}</p>}
                            {cc.banco   && <p><span className="text-kp-gray-lt font-medium">Banco:</span> {cc.banco}</p>}
                            {cc.cbu     && <p><span className="text-kp-gray-lt font-medium">CBU:</span> <span className="font-mono">{cc.cbu}</span></p>}
                            {cc.alias   && <p><span className="text-kp-gray-lt font-medium">Alias:</span> {cc.alias}</p>}
                          </div>
                        ) : null;
                      })()}
                    </section>
                  )}

                  {/* ── Cuenta destino medio 2 (Transferencia / MP / QR) ── */}
                  {usarSegundoMedio && esTransferencia2 && cuentasBancarias.length > 0 && monto2Num > 0.001 && (
                    <section>
                      <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-2">
                        Cuenta destino (Medio 2)
                      </p>
                      <select
                        value={cuentaDestinoId2}
                        onChange={e => setCuentaDestinoId2(e.target.value)}
                        className="w-full bg-kp-surface border border-kp-red/60 rounded-lg px-3 py-2 text-sm text-kp-white
                          focus:outline-none focus:border-kp-red transition-colors"
                      >
                        {cuentasBancarias.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}{c.alias ? ` · ${c.alias}` : ''}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const cc = cuentasBancarias.find(c => c.id === cuentaDestinoId2);
                        return cc ? (
                          <div className="mt-1.5 px-3 py-2 bg-kp-surface2 rounded-lg border border-kp-border text-[11px] text-kp-gray space-y-0.5">
                            {cc.titular && <p><span className="text-kp-gray-lt font-medium">Titular:</span> {cc.titular}</p>}
                            {cc.banco   && <p><span className="text-kp-gray-lt font-medium">Banco:</span> {cc.banco}</p>}
                            {cc.cbu     && <p><span className="text-kp-gray-lt font-medium">CBU:</span> <span className="font-mono">{cc.cbu}</span></p>}
                            {cc.alias   && <p><span className="text-kp-gray-lt font-medium">Alias:</span> {cc.alias}</p>}
                          </div>
                        ) : null;
                      })()}
                    </section>
                  )}

                  {/* ── Cheques ──────────────────────────────────────────── */}
                  {(usarSegundoMedio ? (esCheque || esCheque2) : esCheque) && saldoAFavorAplicado < subtotalFinal - 0.001 && (
                    <section className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-kp-gray uppercase tracking-widest">Cheques</p>
                        <button type="button"
                          onClick={() => setCheques(prev => [...prev, { banco: '', numero_cheque: '', fecha_emision: '', fecha_vencimiento: '', importe: '' }])}
                          className="text-xs text-kp-red hover:underline">
                          + Agregar cheque
                        </button>
                      </div>
                      {cheques.map((ch, i) => (
                        <div key={i} className="bg-kp-surface2 border border-kp-border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-kp-gray">Cheque #{i + 1}</span>
                            {cheques.length > 1 && (
                              <button type="button" onClick={() => setCheques(prev => prev.filter((_, idx) => idx !== i))}
                                className="text-xs text-kp-red hover:underline">Eliminar</button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Banco</p>
                              <input type="text" placeholder="Ej: Galicia" value={ch.banco}
                                onChange={e => setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, banco: e.target.value } : c))}
                                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors" />
                            </div>
                            <div>
                              <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Nro. Cheque</p>
                              <input type="text" placeholder="00001234" value={ch.numero_cheque}
                                onChange={e => setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, numero_cheque: e.target.value } : c))}
                                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors" />
                            </div>
                            <div>
                              <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Fecha de Emisión</p>
                              <input type="date" value={ch.fecha_emision}
                                onChange={e => setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, fecha_emision: e.target.value } : c))}
                                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors" />
                            </div>
                            <div>
                              <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Fecha de Vencimiento</p>
                              <input type="date" value={ch.fecha_vencimiento}
                                onChange={e => setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, fecha_vencimiento: e.target.value } : c))}
                                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors" />
                            </div>
                            <div className="col-span-2">
                              <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">Importe</p>
                              <NumericInput placeholder="0.00" value={ch.importe}
                                onChange={e => setCheques(prev => prev.map((c, idx) => idx === i ? { ...c, importe: e.target.value } : c))}
                                className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}

                  {/* ── Totals ─────────────────────────────────────────────── */}
                  <section className="rounded-xl bg-kp-surface border border-kp-border overflow-hidden">
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-kp-gray">Subtotal</span>
                        <span className="text-xs text-kp-gray-lt tabular-nums font-medium">
                          {ars.format(subtotalBruto)}
                        </span>
                      </div>
                      {descuentoTotal > 0.001 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-kp-red">Descuento</span>
                          <span className="text-xs text-kp-red tabular-nums font-semibold">
                            −{ars.format(descuentoTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3.5 bg-kp-surface2 border-t border-kp-border">
                      <span className="text-sm font-bold uppercase tracking-wide text-kp-white">
                        Total
                      </span>
                      <span className="text-xl font-bold text-kp-white tabular-nums">
                        {ars.format(subtotalFinal)}
                      </span>
                    </div>
                  </section>
                </div>

                {/* ── Action buttons ──────────────────────────────────────── */}
                <div className="p-5 space-y-2.5 border-t border-kp-border shrink-0">
                  {saveError && (
                    <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/20 rounded-lg px-3 py-2">
                      {saveError}
                    </p>
                  )}

                  <button
                    onClick={() => handleSave('preventa')}
                    disabled={cartEmpty || saving !== null}
                    className="w-full border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray
                      px-4 py-2.5 rounded-lg transition-colors text-sm font-semibold
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving === 'preventa' ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner /> Guardando…
                      </span>
                    ) : (
                      'Guardar Preventa'
                    )}
                  </button>

                  <button
                    onClick={() => handleSave('confirmada')}
                    disabled={cartEmpty || saving !== null || cajaAbierta !== true}
                    title={cajaAbierta === false ? 'La caja está cerrada' : undefined}
                    className="w-full bg-kp-red hover:bg-kp-red-dark text-white font-semibold px-4 py-2.5 rounded-lg
                      transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed
                      shadow-lg shadow-kp-red/20"
                  >
                    {saving === 'confirmada' ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner /> Confirmando…
                      </span>
                    ) : cajaAbierta === false ? (
                      'Caja cerrada'
                    ) : (
                      'Confirmar Venta'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
