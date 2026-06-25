import { requireAuth } from '@/lib/requireAuth';
import { serverFetch } from '@/lib/serverFetch';
import DevolucionesView from './DevolucionesView';

export const dynamic = 'force-dynamic';

export type FormaDevolucion = 'efectivo' | 'cuenta_corriente' | 'transferencia' | 'cambio';

export type Devolucion = {
  id: string;
  numero: number | null;
  fecha: string;
  estado: 'emitida' | 'anulada';
  motivo: string;
  numero_referencia: string | null;
  subtotal: number;
  total: number;
  forma_devolucion: FormaDevolucion;
  items: DevItem[] | null;
  created_at: string;
  // Cliente
  cliente_id: string | null;
  cliente_razon_social: string | null;
  cliente_cuit: string | null;
  cliente_direccion: string | null;
  // Sucursal / emisor
  sucursal_nombre:    string | null;
  sucursal_cuit:      string | null;
  sucursal_direccion: string | null;
  sucursal_telefono:  string | null;
  emitida_por_nombre: string | null;
};

export type DevItem = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  articulo_id?: string; // presente si fue del buscador (permite restaurar stock)
};

type Cliente  = { id: string; razon_social: string; cuit: string | null };
type Sucursal = { id: string; nombre: string };

async function fetchDevoluciones(params: Record<string, string>) {
  try {
    const qs = new URLSearchParams();
    if (params.q)           qs.set('q', params.q);
    if (params.estado)      qs.set('estado', params.estado);
    if (params.fecha_desde) qs.set('fecha_desde', params.fecha_desde);
    if (params.fecha_hasta) qs.set('fecha_hasta', params.fecha_hasta);
    qs.set('limit', '50');
    const r = await serverFetch(`/api/devoluciones?${qs}`, { cache: 'no-store' });
    if (!r.ok) return { devoluciones: [], count: 0 };
    return r.json();
  } catch { return { devoluciones: [], count: 0 }; }
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

export default async function DevolucionesPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  requireAuth('/devoluciones');

  const [{ devoluciones, count }, clientes, sucursales] = await Promise.all([
    fetchDevoluciones(searchParams),
    fetchClientes(),
    fetchSucursales(),
  ]);

  return (
    <DevolucionesView
      devolucionesIniciales={devoluciones}
      totalCount={count}
      clientes={clientes}
      sucursales={sucursales}
    />
  );
}
