import VentaDetalle from './VentaDetalle';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export default async function VentaDetallePage({ params }: { params: { id: string } }) {
  const user = requireAuth('/ventas');
  return <VentaDetalle id={params.id} user={user} />;
}
