import { requireAuth } from '@/lib/requireAuth';
import TransporteClient from './TransporteClient';

export const dynamic = 'force-dynamic';

export default function TransportePage() {
  requireAuth('/transporte');
  return <TransporteClient />;
}
