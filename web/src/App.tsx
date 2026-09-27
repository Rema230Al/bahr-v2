import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { usePrefs } from "./i18n/PrefsProvider";
import Nav from "./components/ui/Nav";
import Cursor from "./components/ui/Cursor";
import Grain from "./components/ui/Grain";
import SmoothScroll from "./components/ui/SmoothScroll";
import Home from "./pages/Home";

const Careers = lazy(() => import("./pages/Careers"));
const Admin = lazy(() => import("./pages/Admin"));

export default function App() {
  const { t } = usePrefs();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[80] focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
      >
        {t.meta.skip}
      </a>
      <SmoothScroll />
      <Nav />
      <main id="main" className="relative">
        <Suspense fallback={<div className="min-h-[100svh]" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Cursor />
      <Grain />
    </>
  );
}
