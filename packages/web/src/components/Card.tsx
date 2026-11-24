import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  readonly title?: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
}

export function Card({ title, description, children }: CardProps) {
  return (
    <section className={styles.card}>
      {(title || description) && (
        <div>
          {title && <h2 className={styles.title}>{title}</h2>}
          {description && <p className={styles.description}>{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
