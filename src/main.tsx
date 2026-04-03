import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Flush stale service-worker caches so new styles load immediately
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
