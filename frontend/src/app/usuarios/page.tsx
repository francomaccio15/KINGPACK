import { requireAuth } from '@/lib/requireAuth';
import UsuariosClient from './UsuariosClient';

export const dynamic = 'force-dynamic';

export default function UsuariosPage() {
  requireAuth('/usuarios');
  return <UsuariosClient />;
}
