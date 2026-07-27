import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { StorageProvider } from './context/StorageContext';
import { UndoProvider } from './context/UndoContext';
import './index.css';
import App from './App';

// Register the PWA service worker — only in production builds.
// The manifest link is injected by VitePWA from the vite config.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => {
      // Registration failures are non-fatal — the app works without it.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <StorageProvider>
        {/* Above App on purpose: the 2s merge poll in StorageContext re-renders
            App's hooks, and a pending undo must survive that. */}
        <UndoProvider>
          <App />
        </UndoProvider>
      </StorageProvider>
    </HashRouter>
    <Analytics />
  </StrictMode>
);