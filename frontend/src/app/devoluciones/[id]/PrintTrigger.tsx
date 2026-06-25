'use client';

import { useEffect } from 'react';

// Auto-dispara window.print() si la URL tiene ?print=1
export default function PrintTrigger() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('print=1')) {
      setTimeout(() => window.print(), 500);
    }
  }, []);
  return null;
}
