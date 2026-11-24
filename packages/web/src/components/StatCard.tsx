import type { ReactNode } from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly note?: ReactNode;
}

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}

export function StatGrid({ children }: { readonly children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
