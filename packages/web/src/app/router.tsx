import type { ReactNode } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AlertsScreen } from '../screens/AlertsScreen';
import { CheckScreen } from '../screens/CheckScreen';
import { DisclosureScreen } from '../screens/DisclosureScreen';
import { IncidentScreen } from '../screens/IncidentScreen';
import { LoadScreen } from '../screens/LoadScreen';
import { NotFoundScreen } from '../screens/NotFoundScreen';
import { OverviewScreen } from '../screens/OverviewScreen';
import { VendorScreen } from '../screens/VendorScreen';
import { VendorsScreen } from '../screens/VendorsScreen';
import { useAnalysis } from './AnalysisContext';
import { resultsAccess } from './check';

/** Without a report, every screen but loading sends the user there. */
function RequireReport({ children }: { readonly children: ReactNode }) {
  const { report } = useAnalysis();

  return report ? children : <Navigate to="/" replace />;
}

/** Results are shown only when the files have no errors, or the district chose to see them anyway. */
function RequireResults({ children }: { readonly children: ReactNode }) {
  const { report, acceptedIncomplete } = useAnalysis();

  if (!report) return <Navigate to="/" replace />;
  return resultsAccess(report, acceptedIncomplete) === 'open' ? children : <Navigate to="/check" replace />;
}

const withReport = (screen: ReactNode) => <RequireReport>{screen}</RequireReport>;
const withResults = (screen: ReactNode) => <RequireResults>{screen}</RequireResults>;

export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LoadScreen /> },
      { path: '/check', element: withReport(<CheckScreen />) },
      { path: '/overview', element: withResults(<OverviewScreen />) },
      { path: '/vendors', element: withResults(<VendorsScreen />) },
      { path: '/vendors/:vendorId', element: withResults(<VendorScreen />) },
      { path: '/alerts', element: withResults(<AlertsScreen />) },
      { path: '/disclosure', element: withResults(<DisclosureScreen />) },
      { path: '/incident', element: withResults(<IncidentScreen />) },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]);
