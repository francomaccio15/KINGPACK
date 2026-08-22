'use client';

import Modal from './Modal';
import { btnDanger, btnFullMobile, btnPrimary, btnSecondary, cn, errorCls } from '@/lib/ui';

/**
 * Confirmacion sobre <Modal>. Reemplaza a window.confirm y a los modales de
 * confirmacion escritos a mano (eliminar egreso, anular pago, borrar pedido...).
 *
 * Como se apoya en Modal, hereda scroll-lock con contador: si se abre encima de
 * otro modal, al cerrarse el fondo sigue bloqueado correctamente.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Cuerpo del mensaje. Puede ser texto o JSX (por ejemplo un campo de motivo). */
  children?: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger pinta la accion en rojo: usar para operaciones destructivas. */
  tone?: 'danger' | 'primary';
  loading?: boolean;
  error?: string | null;
  confirmDisabled?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading = false,
  error = null,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={loading} className={cn(btnSecondary, btnFullMobile)}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={cn(tone === 'danger' ? btnDanger : btnPrimary, btnFullMobile)}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="text-sm text-kp-gray-lt">{message}</p>}
      {children}
      {error && <p className={errorCls}>{error}</p>}
    </Modal>
  );
}
