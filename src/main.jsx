import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ErrorBoundary from "../components/ErrorBoundary";
import WordGame from "../components/WordGame";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WordGame />
    </ErrorBoundary>
  </React.StrictMode>
);
