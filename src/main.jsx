import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import NotFound from './views/NotFound.jsx';
import ErrorBoundary from './views/ErrorBoundary.jsx';
import './tailwind.css'; // Tailwind (prefixed, no reset) plus styles.css and theme.css in the legacy layer

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {['/', '/index.html'].includes(window.location.pathname) ? <ErrorBoundary><App /></ErrorBoundary> : <NotFound />}
  </React.StrictMode>,
);
