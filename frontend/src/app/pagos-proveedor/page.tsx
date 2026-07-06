import { requireAuth } from '@/lib/requireAuth';
import PagosProveedorClient from './PagosProveedorClient';

export const dynamic = 'force-dynamic';

export default function PagosProveedorPage() {
  requireAuth('/pagos-proveedor');
  return <PagosProveedorClient />;
}
