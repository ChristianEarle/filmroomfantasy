import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./styles/globals.css";
import { initTracking } from "./services/tracking";

// Clear legacy key from the pre-cookie era (now stored under filmroom_auth_token).
// Wrap in try/catch — localStorage throws in Safari private mode and would crash
// the app before React even mounts.
try {
  localStorage.removeItem('filmroom_token');
} catch {
  // localStorage unavailable — nothing to clean up anyway
}

// Boot ad-platform pixels (no-op for any platform without an env-configured ID).
// Pixels stay dormant until the user grants the matching cookie consent.
initTracking();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
