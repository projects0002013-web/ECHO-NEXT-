import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./style.css";
class Boundary extends Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error) {
    console.error("ECHO application error", error.message);
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>ECHO</h1>
        <p>Something went wrong. Your saved data is still on this device.</p>
        <button onClick={() => location.reload()}>
          Reload application / Перезагрузить
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => console.warn("Offline cache unavailable"));
  });
