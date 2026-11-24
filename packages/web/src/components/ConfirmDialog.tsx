import type { ReactNode } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** A modal question with two answers. Focus stays inside it, and Escape cancels. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <ModalOverlay className={styles.overlay} isOpen={open} onOpenChange={(isOpen) => !isOpen && onCancel()} isDismissable>
      <Modal className={styles.modal}>
        <Dialog role="alertdialog" className={styles.dialog}>
          <Heading slot="title" className={styles.title}>
            {title}
          </Heading>
          <div className={styles.body}>{children}</div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onCancel} autoFocus>
              Cancel
            </Button>
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
