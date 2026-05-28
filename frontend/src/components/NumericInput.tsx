'use client';

import { useState } from 'react';

interface NumericInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'min' | 'max' | 'step'
> {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  /** Decimales a mostrar al formatear (0 = entero). Por defecto 2. */
  decimals?: number;
}

/**
 * Input numérico con formato argentino (punto = miles, coma = decimal).
 * - Sin foco: muestra "1.234.567,89"
 * - Con foco: permite escribir "1.234.567,89" (los puntos se ignoran como separadores de miles)
 * - onChange recibe siempre un string con float estándar ("1234567.89" o "")
 */
export default function NumericInput({
  value,
  onChange,
  decimals = 2,
  onFocus,
  onBlur,
  ...rest
}: NumericInputProps) {
  const [focused,     setFocused]     = useState(false);
  const [editDisplay, setEditDisplay] = useState('');

  const strValue = (value === '' || value == null) ? '' : String(value);

  function formatDisplay(raw: string): string {
    if (!raw) return '';
    const num = parseFloat(raw);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    // Convertir el float almacenado ("1234.56") a formato editable ("1234,56")
    setEditDisplay(strValue ? strValue.replace('.', ',') : '');
    onFocus?.(e);
    // Seleccionar todo para facilitar reemplazo
    setTimeout(() => e.target.select(), 0);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false);
    onBlur?.(e);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    // Solo permitir dígitos, comas (decimal) y puntos (miles, se ignoran en el valor)
    const filtered = raw.replace(/[^\d.,]/g, '');

    // Garantizar una sola coma (decimal)
    const parts = filtered.split(',');
    const display = parts.length > 2
      ? parts[0] + ',' + parts.slice(1).join('')
      : filtered;

    setEditDisplay(display);

    // Valor float: quitar puntos (separadores de miles), reemplazar coma por punto
    const floatStr = display.replace(/\./g, '').replace(',', '.');
    const isEmpty  = floatStr === '' || floatStr === '.';
    onChange({ target: { value: isEmpty ? '' : floatStr } });
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={focused ? editDisplay : formatDisplay(strValue)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}
