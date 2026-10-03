import { requireAuth } from '@/lib/requireAuth';
import CajaAdministrativaClient from './CajaAdministrativaClient';

export const dynamic = 'force-dynamic';

export default function CajaAdministrativaPage() {
  requireAuth('/caja-administrativa');
  return <CajaAdministrativaClient />;
}
