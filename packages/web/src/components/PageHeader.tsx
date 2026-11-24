import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export function PageHeader({ title, children }: { readonly title: string; readonly children?: ReactNode }) {
  return (
    <div>
      <h1 className={styles.title}>{title}</h1>
      {children && <p className={styles.lead}>{children}</p>}
    </div>
  );
}
