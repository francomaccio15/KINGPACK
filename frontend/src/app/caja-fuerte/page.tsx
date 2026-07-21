import { requireAuth } from '@/lib/requireAuth';
import CajaFuerteClient from './CajaFuerteClient';

export const dynamic = 'force-dynamic';

export default function CajaFuertePage() {
  requireAuth('/caja-fuerte');
  return <CajaFuerteClient />;
}
