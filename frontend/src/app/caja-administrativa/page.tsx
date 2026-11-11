import { requireAuth } from '@/lib/requireAuth';
import CajaAdministrativaClient from './CajaAdministrativaClient';

export const dynamic = 'force-dynamic';

export default async function CajaAdministrativaPage() {
  await requireAuth('/caja-administrativa');
  return <CajaAdministrativaClient />;
}
