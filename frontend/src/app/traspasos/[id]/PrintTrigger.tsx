'use client';

import { useEffect } from 'react';

export default function PrintTrigger() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('print=1')) {
      setTimeout(() => window.print(), 500);
    }
  }, []);
  return null;
}
