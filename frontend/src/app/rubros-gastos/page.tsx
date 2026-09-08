import { requireAuth } from '@/lib/requireAuth';
import { getSucursalActivaId } from '@/lib/getSucursalActiva';
import RubrosClient from './RubrosClient';

export const dynamic = 'force-dynamic';

export default function RubrosGastosPage() {
  requireAuth('/rubros-gastos');
  // El toggle de sucursal setea kp_sucursal_id y hace router.refresh(); usarlo
  // como key remonta el cliente para recalcular los totales con la sucursal activa.
  const suc = getSucursalActivaId();
  return <RubrosClient key={suc} />;
}
