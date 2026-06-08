'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden px-4 py-2 text-xs font-semibold rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
    >
      ⎙ Imprimir
    </button>
  );
}
