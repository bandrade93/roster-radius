import { useState } from 'react';
import { Link } from 'react-router';
import type { Population } from '@roster-radius/core';
import { useReport } from '../app/AnalysisContext';
import { alertCounts, disclosureSummary, fieldLabel, sharedFieldsBySensitivity, usesDefaultWeights, vendorRows, type VendorRow } from '../app/overview';
import { Bar } from '../components/Bar';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { RangeValue } from '../components/RangeValue';
import { Segmented } from '../components/Segmented';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatCard, StatGrid } from '../components/StatCard';
import { Table, type Column } from '../components/Table';
import { Tag } from '../components/Tag';
import { formatDate, formatNumber, plural } from '../format/numbers';
import styles from './OverviewScreen.module.css';

const SHARED_SHOWN = 8;

const POPULATIONS = [
  { value: 'students', label: 'Students' },
  { value: 'staff', label: 'Staff' },
] as const;

function vendorColumns(population: Population): readonly Column<VendorRow>[] {
  return [
    {
      key: 'vendor',
      header: 'Vendor',
      render: (v) => (
        <>
          <Link to={`/vendors/${encodeURIComponent(v.vendorId)}`} className={styles.strong}>
            {v.vendorId}
          </Link>
          <br />
          <span className={styles.muted}>
            {v.apps.join(', ')} · {v.channels.join(', ')}
          </span>
        </>
      ),
    },
    { key: 'people', header: population === 'students' ? 'Students' : 'Staff', align: 'right', render: (v) => <RangeValue range={v.people} /> },
    {
      key: 'score',
      header: 'Exposure score',
      render: (v) => (
        <div className={styles.score}>
          <span className={styles.scoreValue}>{formatNumber(v.points)}</span>
          <Bar share={v.share} />
        </div>
      ),
    },
    { key: 'class', header: 'Most sensitive', render: (v) => (v.topClass ? <Tag>{v.topClass}</Tag> : '—') },
    { key: 'fields', header: 'Most sensitive data received', render: (v) => v.topFields.join(', ') },
  ];
}

export function OverviewScreen() {
  const report = useReport();
  const { totals } = report;
  const [population, setPopulation] = useState<Population>('students');
  const [allShared, setAllShared] = useState(false);

  const vendors = vendorRows(report, population);
  const sharedAll = sharedFieldsBySensitivity(report);
  const shared = allShared ? sharedAll : sharedAll.slice(0, SHARED_SHOWN);
  const disclosure = disclosureSummary(report);
  const firstAlerts = report.alerts.slice(0, 3);
  const staffVendors = vendorRows(report, 'staff').length;

  return (
    <>
      <PageHeader title="Overview">
        Results for {formatDate(report.today)} · weights: methodology v{report.methodologyVersion} {usesDefaultWeights(report) ? 'defaults' : '(changed)'}
      </PageHeader>

      <StatGrid>
        <StatCard label="Students whose data reaches a vendor" value={<RangeValue range={totals.studentsReached} />} note={`of ${formatNumber(totals.students)} enrolled`} />
        <StatCard label="Vendors" value={formatNumber(totals.vendors)} note={`${plural(totals.apps, 'app')} · ${plural(totals.channels, 'channel')}`} />
        <StatCard label="Staff whose data reaches a vendor" value={<RangeValue range={totals.staffReached} />} note={`of ${formatNumber(totals.staff)} staff, through ${plural(staffVendors, 'vendor')}`} />
        <StatCard
          label="Alerts"
          value={<Link to="/alerts" className={styles.statLink}>{formatNumber(report.alerts.length)}</Link>}
          note={
            <span className={styles.badges}>
              {alertCounts(report).map((c) => (
                <SeverityBadge key={c.severity} severity={c.severity} count={c.count} />
              ))}
            </span>
          }
        />
      </StatGrid>

      <Card title="What is shared, across all vendors" description="Students with each kind of data at one vendor or more. These counts do not depend on the weights.">
        <ul className={styles.shared}>
          {shared.map((f) => (
            <li key={f.field} className={styles.sharedRow}>
              <span className={styles.sharedLabel}>{fieldLabel(f.field)}</span>
              <span className={styles.sharedCount}>
                <RangeValue range={f.students} />
              </span>
              <Bar share={f.students.max / Math.max(1, totals.students)} tone="neutral" />
              <span className={styles.muted}>{plural(f.vendors.length, 'vendor')}</span>
            </li>
          ))}
        </ul>
        {report.sharedFields.length > SHARED_SHOWN && (
          <div>
            <button type="button" className={styles.more} aria-expanded={allShared} onClick={() => setAllShared(!allShared)}>
              {allShared ? 'Show fewer' : `Show all ${report.sharedFields.length} fields`}
            </button>
          </div>
        )}
      </Card>

      <Card title="Vendors by exposure" description="Exposure score: each person counted once per vendor, with the weights of every field the vendor receives about them. Used to rank, not a probability of breach.">
        <Segmented label="Show vendors by" options={POPULATIONS} value={population} onChange={setPopulation} />
        {vendors.length === 0 ? (
          <p className={styles.muted}>No vendor receives {population} data.</p>
        ) : (
          <Table caption={`Vendors by exposure, ${population}`} columns={vendorColumns(population)} rows={vendors} rowKey={(v) => v.vendorId} minWidth={900} />
        )}
      </Card>

      <div className={styles.pair}>
        <Card title="Alerts to act on" description="Most severe first.">
          {firstAlerts.length === 0 ? (
            <p className={styles.muted}>No alerts.</p>
          ) : (
            <ul className={styles.list}>
              {firstAlerts.map((a, i) => (
                <li key={i} className={styles.alert}>
                  <SeverityBadge severity={a.severity} />
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/alerts" className={styles.strong}>
            See all {plural(report.alerts.length, 'alert')}
          </Link>
        </Card>

        <Card title="Your published list" description="What your district published about the vendors that receive student data, compared with what flows.">
          {disclosure ? (
            <>
              <p>
                <span className={styles.big}>
                  {disclosure.disclosed} of {disclosure.receiving}
                </span>{' '}
                vendors that receive student data are in your published list.
              </p>
              <ul className={styles.list}>
                {disclosure.counts.undisclosed_vendor > 0 && <li>{plural(disclosure.counts.undisclosed_vendor, 'vendor')} not in the list</li>}
                {disclosure.counts.undisclosed_app > 0 && <li>{plural(disclosure.counts.undisclosed_app, 'app')} left out for a listed vendor</li>}
                {disclosure.counts.undisclosed_data > 0 && <li>{plural(disclosure.counts.undisclosed_data, 'app')} receiving data the list does not mention</li>}
                {disclosure.counts.no_longer_receives > 0 && <li>{plural(disclosure.counts.no_longer_receives, 'entry', 'entries')} for vendors that no longer receive data</li>}
              </ul>
              <Link to="/disclosure" className={styles.strong}>
                See the comparison
              </Link>
            </>
          ) : (
            <p className={styles.muted}>No published list was loaded. Load it to check whether it names every vendor and every kind of data that flows.</p>
          )}
        </Card>
      </div>
    </>
  );
}
