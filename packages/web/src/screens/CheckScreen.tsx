import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { FlowSummary, PeopleResolution } from '@roster-radius/core';
import { useAnalysis, useReport } from '../app/AnalysisContext';
import { describeFiles, fileLabel, matchingNotes, resultsAccess, sortIssues, type FileStatus } from '../app/check';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IssueBadge } from '../components/IssueBadge';
import { PageHeader } from '../components/PageHeader';
import { Table, type Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { channelLabel } from '../format/labels';
import { formatNumber, plural } from '../format/numbers';
import styles from './CheckScreen.module.css';

function statusText(status: FileStatus, errors: number, warnings: number): string {
  if (status === 'unused') return 'Not used';

  const parts = status === 'error' ? [] : ['Read'];
  if (errors > 0) parts.push(plural(errors, 'error'));
  if (warnings > 0) parts.push(plural(warnings, 'warning'));

  return parts.join(' · ');
}

function people(p: PeopleResolution): string {
  switch (p.kind) {
    case 'none':
      return '—';
    case 'roster':
      return `${formatNumber(p.count)} from the roster`;
    case 'file':
      return `${formatNumber(p.count)} listed in a file`;
    case 'count':
      return p.source === 'entered' ? `${formatNumber(p.count)}, typed` : `${formatNumber(p.count)}, counted in a file`;
  }
}

const COLUMNS: readonly Column<FlowSummary>[] = [
  { key: 'line', header: 'Line', align: 'right', render: (f) => f.line },
  {
    key: 'app',
    header: 'App',
    render: (f) => (
      <>
        <span className={styles.strong}>{f.app}</span>
        <br />
        <span className={styles.muted}>{f.vendor}</span>
      </>
    ),
  },
  { key: 'channel', header: 'Channel', render: (f) => channelLabel(f.channel) },
  {
    key: 'fields',
    header: 'Fields',
    render: (f) => (
      <span className={styles.cell}>
        {plural(f.fields.length, 'field')} <Tag tone={f.fieldSource === 'measured' ? 'info' : 'neutral'}>{f.fieldSource}</Tag>
      </span>
    ),
  },
  { key: 'students', header: 'Students', render: (f) => people(f.students) },
  { key: 'staff', header: 'Staff', render: (f) => people(f.staff) },
];

export function CheckScreen() {
  const report = useReport();
  const { acceptedIncomplete, acceptIncomplete } = useAnalysis();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const files = describeFiles(report);
  const issues = sortIssues(report.issues);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const access = resultsAccess(report, acceptedIncomplete);
  const { rowsLeftOut } = report.completeness;

  const showAnyway = () => {
    acceptIncomplete();
    setConfirming(false);
    navigate('/overview');
  };

  return (
    <>
      <PageHeader title="Check your files">
        Every file was read on this computer. Errors must be fixed before the results can be shown; warnings are worth reviewing, but do not stop them.
      </PageHeader>

      <Card title="Files read">
        <ul className={styles.files}>
          {files.map((f) => (
            <li key={f.title} className={styles.file}>
              <span className={`${styles.icon} ${styles[f.status]}`} aria-hidden="true">
                {f.status === 'read' ? '✓' : f.status === 'unused' ? '–' : '!'}
              </span>
              <div className={styles.fileText}>
                <p className={styles.strong}>{f.title}</p>
                <p className={styles.muted}>{f.detail}</p>
              </div>
              <span className={`${styles.statusText} ${styles[f.status]}`}>
                {statusText(f.status, f.errors, f.warnings)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Problems to review" description={issues.length === 0 ? 'No problems found.' : `${plural(issues.length - errors, 'warning')} · ${plural(errors, 'error')}`}>
        {issues.length > 0 && (
          <ul className={styles.issues}>
            {issues.map((i, n) => (
              <li key={n} className={styles.issue}>
                <IssueBadge severity={i.severity} />
                <div className={styles.fileText}>
                  <p className={styles.location}>
                    {fileLabel(i.file)}
                    {i.line !== undefined && ` · line ${i.line}`}
                    {i.column && ` · ${i.column}`}
                    {i.count !== undefined && i.count > 1 && ` · ${plural(i.count, 'row')}`}
                  </p>
                  <p>{i.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="How people were matched" description="Each student and staff member is counted once across files.">
        <ul className={styles.notes}>
          {matchingNotes(report.flows).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Card>

      <Card title="What was read from each inventory row" description="Fields are measured when read from a file the vendor receives, and entered when typed in the inventory.">
        <Table caption="What was read from each inventory row" columns={COLUMNS} rows={report.flows} rowKey={(f) => String(f.line)} minWidth={820} />
      </Card>

      <div className={styles.actions}>
        {access === 'blocked' && <p className={styles.blocked}>No results can be calculated from these files: the roster gave no students or staff, or no inventory row could be read. Fix the files and load them again.</p>}
        {access === 'needs-confirmation' && <p className={styles.blocked}>Fix the errors above and load the files again to see complete results.</p>}
        <Button variant="secondary" onClick={() => navigate('/')}>
          Load other files
        </Button>
        {access === 'needs-confirmation' && (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Show results anyway
          </Button>
        )}
        <Button onClick={() => navigate('/overview')} disabled={access !== 'open'}>
          See results
        </Button>
      </div>

      <ConfirmDialog open={confirming} title="Show incomplete results?" confirmLabel="Show incomplete results" onConfirm={showAnyway} onCancel={() => setConfirming(false)}>
        <p>
          {plural(rowsLeftOut, 'row')} {rowsLeftOut === 1 ? 'was' : 'were'} left out because of errors. The results will be incomplete.
        </p>
        <p>Every results screen, and any report you save, will say so.</p>
      </ConfirmDialog>
    </>
  );
}
