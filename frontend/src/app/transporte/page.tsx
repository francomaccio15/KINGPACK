import { requireAuth } from '@/lib/requireAuth';
import TransporteClient from './TransporteClient';

export const dynamic = 'force-dynamic';

export default async function TransportePage() {
  await requireAuth('/transporte');
  return <TransporteClient />;
}
