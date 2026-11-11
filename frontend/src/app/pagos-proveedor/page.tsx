import { requireAuth } from '@/lib/requireAuth';
import PagosProveedorClient from './PagosProveedorClient';

export const dynamic = 'force-dynamic';

export default async function PagosProveedorPage() {
  await requireAuth('/pagos-proveedor');
  return <PagosProveedorClient />;
}
