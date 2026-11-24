import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AnalysisProvider } from './app/AnalysisContext';
import { router } from './app/router';
import { createAnalysisClient } from './worker/client';
import './styles/tokens.css';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element.');

createRoot(root).render(
  <StrictMode>
    <AnalysisProvider client={createAnalysisClient()}>
      <RouterProvider router={router} />
    </AnalysisProvider>
  </StrictMode>,
);
