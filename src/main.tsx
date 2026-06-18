import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Keep --app-height in sync with the *visible* viewport. On Android the soft
// keyboard does not shrink `100dvh`, so full-height shells (PhoneFrame) would
// otherwise extend behind the keyboard and the scroll area gets stuck. Driving
// the shell height from visualViewport.height fixes scrolling while the keyboard
// is open, regardless of the native windowSoftInputMode behaviour.
function syncViewportHeight() {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
}

syncViewportHeight();
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", syncViewportHeight);
  window.visualViewport.addEventListener("scroll", syncViewportHeight);
}
window.addEventListener("resize", syncViewportHeight);
window.addEventListener("orientationchange", syncViewportHeight);

createRoot(document.getElementById("root")!).render(<App />);
