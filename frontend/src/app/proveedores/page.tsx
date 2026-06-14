import { requireAuth } from '@/lib/requireAuth';
import ProveedoresClient from './ProveedoresClient';

export const dynamic = 'force-dynamic';

export default function ProveedoresPage() {
  requireAuth('/proveedores');
  return <ProveedoresClient />;
}
