import type { Severity } from '@roster-radius/core';
import styles from './SeverityBadge.module.css';

const LABELS: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', info: 'Info' };

function Icon({ severity }: { readonly severity: Severity }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, 'aria-hidden': true };

  if (severity === 'critical') {
    return (
      <svg {...common}>
        <path d="M12 3 2 21h20L12 3z" />
        <path d="M12 10v5" />
        <path d="M12 18h.01" />
      </svg>
    );
  }

  if (severity === 'info') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6" />
        <path d="M12 7.5h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

export function SeverityBadge({ severity, count }: { readonly severity: Severity; readonly count?: number }) {
  const text = count === undefined ? LABELS[severity] : `${count} ${LABELS[severity].toLowerCase()}`;

  return (
    <span className={`${styles.badge} ${styles[severity]}`}>
      <Icon severity={severity} />
      {text}
    </span>
  );
}
