console.log('[MAIN] Starting application...');

import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

console.log('[MAIN] Imports loaded, mounting React...');

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('[MAIN] Root element not found!');
} else {
  console.log('[MAIN] Root element found, creating React root...');
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  console.log('[MAIN] React mounted successfully');
}
