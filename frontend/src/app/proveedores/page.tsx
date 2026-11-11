import { requireAuth } from '@/lib/requireAuth';
import ProveedoresClient from './ProveedoresClient';

export const dynamic = 'force-dynamic';

export default async function ProveedoresPage() {
  await requireAuth('/proveedores');
  return <ProveedoresClient />;
}
