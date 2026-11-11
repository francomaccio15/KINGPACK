import { requireAuth } from '@/lib/requireAuth';
import UsuariosClient from './UsuariosClient';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  await requireAuth('/usuarios');
  return <UsuariosClient />;
}
