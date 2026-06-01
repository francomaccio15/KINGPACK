import Image from 'next/image';

// logo-dark.png  → fondo transparente, negro→blanco, rojo se mantiene (para UI oscura)
// logo.png       → colores originales con fondo blanco (para impresión)
// logo-symbol.png → corona + monograma sin texto (para sidebar colapsado)

/** Login: logo completo sobre fondo oscuro */
export function KingPackLogoFull({ className }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className ?? ''}`}>
      <Image
        src="/logo-dark.png"
        alt="King Pack Descartables"
        width={200}
        height={150}
        priority
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}

/** Header: logo compacto horizontal */
export function KingPackLogoHorizontal({ className }: { className?: string }) {
  return (
    <div className={`flex items-center ${className ?? ''}`}>
      <Image
        src="/logo-dark.png"
        alt="King Pack"
        width={120}
        height={90}
        priority
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}

/** Sidebar colapsado: solo el símbolo (corona + monograma) */
export function KingPackCrown({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Image
        src="/logo-symbol.png"
        alt="King Pack"
        width={size}
        height={size}
        style={{ objectFit: 'contain' }}
      />
    </span>
  );
}

/** Header con subtítulo "· Gestión" — símbolo compacto + texto */
export function KingPackLogoWithSubtitle({
  subtitle,
  className,
}: {
  subtitle: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      {/* Solo el símbolo gráfico (corona + monograma), sin texto */}
      <Image
        src="/logo-symbol.png"
        alt="King Pack"
        width={36}
        height={36}
        priority
        style={{ objectFit: 'contain' }}
      />
      <div className="leading-none">
        <span className="text-base font-black tracking-[0.1em] uppercase text-kp-white">
          KING PACK
        </span>
        <span className="text-kp-red mx-1.5 font-bold">·</span>
        <span className="font-normal text-kp-gray text-sm normal-case tracking-normal">
          {subtitle}
        </span>
      </div>
    </div>
  );
}

/** Print: colores originales sobre fondo blanco */
export function KingPackLogoPrint() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="King Pack Descartables"
      style={{ height: '64px', objectFit: 'contain' }}
    />
  );
}
