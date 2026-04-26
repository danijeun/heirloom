import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./ErrorBoundary";
import { Home } from "./pages/Home";
import { Artifact } from "./pages/Artifact";
import { Mine } from "./pages/Mine";
import { Footer } from "./components/Footer";
import { useClaimOnLogin } from "./auth";
import "./styles.css";

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

function App() {
  useClaimOnLogin();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/a/:id" element={<Artifact readOnly />} />
        <Route path="/artifact/:id" element={<Artifact />} />
        <Route path="/mine" element={<Mine />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
