import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/serverFetch';
import { requireAuth } from '@/lib/requireAuth';
import CobranzasClient, { type ClienteCobranza } from './CobranzasClient';

export const dynamic = 'force-dynamic';

/**
 * Cobranzas — pantalla para que el cajero registre el pago de un cliente que
 * viene al mostrador, sin tener que entrar a la ficha de cada cliente.
 * Es la misma operación que "Registrar Pago" en /clientes/[id]; acá sólo cambia
 * el acceso: buscador sobre todos los clientes y cobro en un click.
 */
export default async function CobranzasPage() {
  requireAuth('/cobranzas');

  // Sucursal operativa (selector global); el backend igual usa la del JWT del cajero.
  const sucursalId = cookies().get('kp_sucursal_id')?.value;

  const [clientes, cajaAbierta] = await Promise.all([
    serverFetch('/api/clientes?limit=1000&activo=true', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => (d.clientes ?? []) as ClienteCobranza[])
      .catch(() => [] as ClienteCobranza[]),
    // El efectivo y los cheques sólo entran a la caja si hay una abierta; si no,
    // el pago se registra igual en la cuenta corriente pero no impacta en caja.
    serverFetch(
      `/api/caja?estado=abierta&limit=1${sucursalId ? `&sucursal_id=${sucursalId}` : ''}`,
      { cache: 'no-store' },
    )
      .then(r => r.json())
      .then(d => (d.cajas ?? []).length > 0)
      .catch(() => true),
  ]);

  return <CobranzasClient clientes={clientes} sucursalId={sucursalId} cajaAbierta={cajaAbierta} />;
}
