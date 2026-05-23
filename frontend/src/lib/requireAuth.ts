import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Llama esta función al inicio de cualquier Server Component protegido.
 * Si no hay cookie kp_token redirige a /login antes de renderizar la página.
 */
export function requireAuth(): void {
  const token = cookies().get('kp_token')?.value;
  if (!token) redirect('/login');
}
