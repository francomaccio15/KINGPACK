import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import NotasCreditoView from './NotasCreditoView';

export const dynamic = 'force-dynamic';

export type NotaCredito = {
  id: string;
  numero: number | null;
  fecha: string;
  estado: 'emitida' | 'anulada';
  motivo: string;
  numero_referencia: string | null;
  subtotal: number;
  iva_pct: number;
  iva_monto: number;
  total: number;
  items: NcItem[] | null;
  cae: string | null;
  created_at: string;
  // Cliente
  cliente_id: string | null;
  cliente_razon_social: string | null;
  cliente_cuit: string | null;
  cliente_direccion: string | null;
  // Comprobante
  tipo_comprobante: string | null;
  tipo_letra: string | null;
  tipo_codigo_afip: number | null;
  // Sucursal / emisor
  sucursal_nombre:    string | null;
  sucursal_cuit:      string | null;
  sucursal_direccion: string | null;
  sucursal_telefono:  string | null;
  emitida_por_nombre: string | null;
  // Factura original
  factura_id: string | null;
  factura_numero: number | null;
  factura_punto_venta: number | null;
};

export type NcItem = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  articulo_id?: string; // presente si fue seleccionado del buscador (permite restaurar stock)
};

type TipoComprobante = { id: string; codigo_afip: number; letra: string; descripcion: string };
type Cliente        = { id: string; razon_social: string; cuit: string | null };
type Sucursal       = { id: string; nombre: string };

async function fetchNotas(params: Record<string, string>) {
  try {
    const qs = new URLSearchParams();
    if (params.q)           qs.set('q', params.q);
    if (params.estado)      qs.set('estado', params.estado);
    if (params.fecha_desde) qs.set('fecha_desde', params.fecha_desde);
    if (params.fecha_hasta) qs.set('fecha_hasta', params.fecha_hasta);
    qs.set('limit', '50');
    const r = await serverFetch(`/api/notas-credito?${qs}`, { cache: 'no-store' });
    if (!r.ok) return { notas: [], count: 0 };
    return r.json();
  } catch { return { notas: [], count: 0 }; }
}

async function fetchTipos(): Promise<TipoComprobante[]> {
  try {
    // Solo tipos de nota de crédito: códigos 3 (A), 8 (B), 13 (C)
    const r = await serverFetch('/api/arca/tipos-comprobante', { cache: 'no-store' });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.tipos ?? []).filter((t: TipoComprobante) =>
      [3, 8, 13].includes(t.codigo_afip)
    );
  } catch { return []; }
}

async function fetchTiposDirecto(): Promise<TipoComprobante[]> {
  try {
    const r = await serverFetch('/api/notas-credito/tipos', { cache: 'no-store' });
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}

async function fetchClientes(): Promise<Cliente[]> {
  try {
    const r = await serverFetch('/api/clientes?limit=500&activo=true', { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).clientes ?? [];
  } catch { return []; }
}

async function fetchSucursales(): Promise<Sucursal[]> {
  try {
    const r = await serverFetch('/api/sucursales', { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).sucursales ?? [];
  } catch { return []; }
}

async function fetchTiposComprobante(): Promise<TipoComprobante[]> {
  try {
    // Query directo a la DB via backend genérico no existe, usamos el endpoint de facturaciones
    const r = await serverFetch('/api/ventas?limit=1', { cache: 'no-store' });
    if (!r.ok) return [];
    // Si no hay endpoint dedicado, retornamos los datos hardcodeados
    return [];
  } catch { return []; }
}

export default async function NotasCreditoPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  requireAuth('/notas-credito');

  const [{ notas, count }, clientes, sucursales] = await Promise.all([
    fetchNotas(searchParams),
    fetchClientes(),
    fetchSucursales(),
  ]);

  // Tipos de comprobante NC: hardcodeados (ya están en la DB como tipos_comprobante)
  // Código 3 = NC A, 8 = NC B, 13 = NC C
  const tiposNC: TipoComprobante[] = [
    { id: '9a44544b-ac17-4c7b-8074-8084b29054a8', codigo_afip: 3,  letra: 'A', descripcion: 'Nota de Crédito A' },
    { id: '52d27895-6bd5-4590-954e-ee6add56a2ff', codigo_afip: 8,  letra: 'B', descripcion: 'Nota de Crédito B' },
    { id: '1bc020c0-819b-4392-9403-6e0268e005df', codigo_afip: 13, letra: 'C', descripcion: 'Nota de Crédito C' },
  ];

  return (
    <NotasCreditoView
      notasIniciales={notas}
      totalCount={count}
      clientes={clientes}
      sucursales={sucursales}
      tiposNC={tiposNC}
    />
  );
}
