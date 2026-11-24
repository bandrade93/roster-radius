import type { ReactNode } from 'react';
import styles from './Tag.module.css';

export function Tag({ tone = 'neutral', children }: { readonly tone?: 'neutral' | 'info'; readonly children: ReactNode }) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>;
}
