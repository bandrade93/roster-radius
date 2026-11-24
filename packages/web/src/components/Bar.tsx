import styles from './Bar.module.css';

interface BarProps {
  /** From 0 to 1. */
  readonly share: number;
  readonly tone?: 'accent' | 'neutral';
}

/** A proportion drawn as a bar. Decorative: the number it shows must also be written next to it. */
export function Bar({ share, tone = 'accent' }: BarProps) {
  const width = `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`;

  return (
    <div className={styles.track} aria-hidden="true">
      <div className={`${styles.fill} ${styles[tone]}`} style={{ width }} />
    </div>
  );
}
