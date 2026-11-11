import VentaDetalle from '../../ventas/[id]/VentaDetalle';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

// Detalle del presupuesto: misma vista que la venta, accesible para el
// preventista (que no tiene permiso a /ventas).
export default async function PresupuestoDetallePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requireAuth('/presupuestos');
  return <VentaDetalle id={params.id} user={user} desde="presupuestos" />;
}
