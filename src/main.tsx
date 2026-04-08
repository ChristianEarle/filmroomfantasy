import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./styles/globals.css";

// Clear legacy key from the pre-cookie era (now stored under filmroom_auth_token).
// Wrap in try/catch — localStorage throws in Safari private mode and would crash
// the app before React even mounts.
try {
  localStorage.removeItem('filmroom_token');
} catch {
  // localStorage unavailable — nothing to clean up anyway
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
