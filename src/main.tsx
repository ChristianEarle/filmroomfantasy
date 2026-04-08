import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./styles/globals.css";

// Clear legacy key from the pre-cookie era (now stored under filmroom_auth_token)
localStorage.removeItem('filmroom_token');

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
