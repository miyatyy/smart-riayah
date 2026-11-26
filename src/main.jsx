import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary';
import './index.css';

// Security & Data Protection: Padamkan console di production agar data & arsitektur sistem tidak bocor
if (
  import.meta.env.PROD ||
  (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1')
) {
  const noop = () => {};
  const methods = [
    'log', 'debug', 'info', 'warn', 'error', 'table', 'trace',
    'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd',
    'time', 'timeEnd', 'timeLog', 'count', 'assert', 'clear'
  ];
  methods.forEach((method) => {
    try {
      console[method] = noop;
    } catch {}
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
