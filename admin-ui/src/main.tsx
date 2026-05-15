import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { rememberAdminTokenFromUrl } from "./api";
import { App } from "./App";
import "./styles.css";

rememberAdminTokenFromUrl();
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
