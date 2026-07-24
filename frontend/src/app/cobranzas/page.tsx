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

  const clientes: ClienteCobranza[] = await serverFetch(
    '/api/clientes?limit=1000&activo=true',
    { cache: 'no-store' },
  )
    .then(r => r.json())
    .then(d => d.clientes ?? [])
    .catch(() => []);

  // Sucursal operativa (selector global); el backend igual usa la del JWT del cajero.
  const sucursalId = cookies().get('kp_sucursal_id')?.value;

  return <CobranzasClient clientes={clientes} sucursalId={sucursalId} />;
}
