import { requireAuth } from '@/lib/requireAuth';
import CuentasClient from './CuentasClient';

export const dynamic = 'force-dynamic';

export default async function CuentasBancariasPage() {
  await requireAuth('/cuentas-bancarias');
  return <CuentasClient />;
}
