'use client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EstadoCuentaPDF({ clienteId }: { clienteId: string }) {
  const abrir = () => window.open(`${API}/api/clientes/${clienteId}/pdf-estado-cuenta`, '_blank');

  return (
    <button
      onClick={abrir}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border
        text-kp-gray hover:text-kp-white hover:border-kp-gray text-sm font-medium transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      Imprimir Cuenta
    </button>
  );
}
