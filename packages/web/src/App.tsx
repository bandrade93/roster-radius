import { useState } from 'react';
import type { DistrictReport } from '@roster-radius/core';
import type { AnalysisClient } from './worker/client';

type Status = { readonly kind: 'idle' } | { readonly kind: 'working' } | { readonly kind: 'done'; readonly report: DistrictReport } | { readonly kind: 'failed'; readonly error: string };

/**
 * Placeholder shell for the screens of task 1.5.4. It runs the sample
 * district through the worker, to show the engine, the worker and the page
 * working together.
 */
export function App({ client }: { readonly client: AnalysisClient }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const trySample = async () => {
    setStatus({ kind: 'working' });
    const result = await client.request({ type: 'sample' });
    setStatus(result.ok ? { kind: 'done', report: result.report } : { kind: 'failed', error: result.error });
  };

  return (
    <main className="shell">
      <h1>RosterRadius</h1>
      <p>See which vendors receive which student data in your district. Everything runs in this browser; nothing is sent.</p>
      <button type="button" onClick={trySample} disabled={status.kind === 'working'}>
        Try the sample district
      </button>
      <div role="status" aria-live="polite">
        {status.kind === 'working' && <p>Analyzing…</p>}
        {status.kind === 'failed' && <p className="error">{status.error}</p>}
        {status.kind === 'done' && (
          <p>
            {status.report.totals.students.toLocaleString('en-US')} students, {status.report.totals.vendors} vendors, {status.report.alerts.length} alerts.
          </p>
        )}
      </div>
    </main>
  );
}
