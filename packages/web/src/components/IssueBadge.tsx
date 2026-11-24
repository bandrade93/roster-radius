import styles from './SeverityBadge.module.css';

export function IssueBadge({ severity }: { readonly severity: 'error' | 'warning' }) {
  return (
    <span className={`${styles.badge} ${severity === 'error' ? styles.critical : styles.medium}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M12 3 2 21h20L12 3z" />
        <path d="M12 10v5" />
        <path d="M12 18h.01" />
      </svg>
      {severity === 'error' ? 'Error' : 'Warning'}
    </span>
  );
}
