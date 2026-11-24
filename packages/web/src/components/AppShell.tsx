import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { useAnalysis } from '../app/AnalysisContext';
import { resultsAccess } from '../app/check';
import { plural } from '../format/numbers';
import { Logo } from './Logo';
import styles from './AppShell.module.css';

const SECTIONS = [
  { to: '/check', label: 'Files' },
  { to: '/overview', label: 'Overview' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/disclosure', label: 'Published list' },
  { to: '/incident', label: 'Incident' },
] as const;

export function AppShell() {
  const { report, acceptedIncomplete } = useAnalysis();
  const { pathname } = useLocation();
  const open = report !== undefined && resultsAccess(report, acceptedIncomplete) === 'open';
  const sections = open ? SECTIONS : SECTIONS.slice(0, 1);
  const showIncomplete = open && !report.completeness.complete && pathname !== '/' && pathname !== '/check';

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#content">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link to="/" className={styles.brand}>
            <Logo />
            <span>RosterRadius</span>
          </Link>
          {report && (
            <nav aria-label="Main" className={styles.nav}>
              {sections.map((s) => (
                <NavLink key={s.to} to={s.to} className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
                  {s.label}
                </NavLink>
              ))}
            </nav>
          )}
          <span className={styles.local}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Local only · nothing uploaded
          </span>
        </div>
      </header>
      {showIncomplete && (
        <div className={styles.incomplete}>
          <p className={styles.incompleteText}>
            <strong>Incomplete:</strong> {plural(report.completeness.rowsLeftOut, 'row')} left out because of errors. <Link to="/check">Review them in Files</Link>
          </p>
        </div>
      )}
      <main id="content" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}
