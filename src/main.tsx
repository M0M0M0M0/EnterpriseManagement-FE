import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { appTheme } from "./app/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={appTheme} className="fluent-root">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </FluentProvider>
  </StrictMode>,
);
