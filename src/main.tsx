import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-time cleanup: unregister any leftover service workers from the old PWA setup
// so users stop seeing cached/stale styles. Safe to remove after a few weeks.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      Promise.all(registrations.map((r) => r.unregister())).then(() => {
        caches.keys().then((names) => {
          Promise.all(names.map((n) => caches.delete(n))).then(() => {
            window.location.reload();
          });
        });
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
