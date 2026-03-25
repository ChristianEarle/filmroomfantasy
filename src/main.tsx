import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/globals.css";

// One-time migration: clear legacy localStorage token (auth now uses httpOnly cookies)
localStorage.removeItem('filmroom_token');

createRoot(document.getElementById("root")!).render(<App />);
