import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { startConnectionMonitor } from "@/offline/connection";
import { setupServiceWorker } from "@/offline/serviceWorker";
import { startSyncSummary } from "@/offline/syncSummary";

// Offline mode: kalagayan ng koneksyon, buod ng hindi pa naipapadala, at ang service worker
startConnectionMonitor();
startSyncSummary();
void setupServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
