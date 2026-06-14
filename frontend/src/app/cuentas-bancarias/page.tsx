import { requireAuth } from '@/lib/requireAuth';
import CuentasClient from './CuentasClient';

export const dynamic = 'force-dynamic';

export default function CuentasBancariasPage() {
  requireAuth('/cuentas-bancarias');
  return <CuentasClient />;
}
