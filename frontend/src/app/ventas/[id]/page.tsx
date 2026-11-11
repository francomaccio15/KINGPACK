import VentaDetalle from './VentaDetalle';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export default async function VentaDetallePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requireAuth('/ventas');
  return <VentaDetalle id={params.id} user={user} />;
}
