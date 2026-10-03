import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { api, ApiError } from "../lib/api";
import { TextField } from "../components/ui/Field";
import Logo from "../components/ui/Logo";
import MagneticButton from "../components/ui/Magnetic";
import SeaWaves, { SEA_PADDING } from "../components/ui/SeaWaves";
import { ALL_TIME, appliedRange } from "../lib/dateRange";
import Sidebar from "./admin/Sidebar";
import FilterBar from "./admin/FilterBar";
import Leads from "./admin/Leads";
import Inquiries from "./admin/Inquiries";
import Openings from "./admin/Openings";
import type { Admin as AdminUser } from "./admin/LeadPanel";
import { NO_FILTERS, VIEWS, type View } from "./admin/filters";

/**
 * Admin dashboard. The UI hides itself without a session, but the real gate is the server:
 * every /admin/* request is checked there regardless of what this page shows.
 * (English-only by design — it's an internal tool.) Views live in ./admin/.
 */
export default function Admin() {
  const [me, setMe] = useState<{ email: string } | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(setMe, () => setMe(null));
  }, []);

  if (me) return <Dashboard email={me.email} onLogout={() => setMe(null)} />;

  return (
    // The sea is only on the sign-in screen; the dashboard itself stays still and calm.
    <div className={`relative min-h-[100svh] px-[var(--gutter)] pt-28 md:pt-36 ${SEA_PADDING}`} dir="ltr" lang="en">
      <Link to="/" aria-label="Bahr — back to the site" className="absolute start-[var(--gutter)] top-5 md:top-6">
        <Logo />
      </Link>
      <SeaWaves />
      <div className="relative">
        {me === undefined && <p className="label">Checking session…</p>}
        {me === null && <Login onDone={setMe} />}
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: (me: { email: string }) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(email.trim(), password);
      onDone(await api.me());
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(
        code === "rate_limited"
          ? "Too many attempts. Try again in a few minutes."
          : code === "invalid_credentials"
            ? "Wrong email or password."
            : "Couldn't sign in. Please try again.",
      );
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={submit}
      className="mx-auto grid max-w-sm gap-5"
      aria-labelledby="login-title"
    >
      <p className="label">Bahr · Admin</p>
      <h1 id="login-title" className="display text-[length:var(--fs-xl)]">
        Sign in
      </h1>
      <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && (
        <p role="alert" className="text-signal">
          {error}
        </p>
      )}
      <div>
        <MagneticButton type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </MagneticButton>
      </div>
    </motion.form>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

function Dashboard({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [view, setView] = useState<View>("leads");
  // Filters live here, above the views, so they are kept when switching views.
  const [dates, setDates] = useState(ALL_TIME);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const range = appliedRange(dates);

  useEffect(() => {
    api.admins().then(setAdmins, () => undefined);
  }, []);

  const signOut = async () => {
    await api.logout().catch(() => undefined);
    onLogout();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="admin min-h-[100svh] bg-bg text-ink lg:flex" dir="ltr" lang="en">
        <Sidebar view={view} onView={setView} email={email} onSignOut={signOut} />
        <div className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-[1480px]">
            <header className="mb-5">
              <h1 className="text-2xl font-semibold tracking-tight">{VIEWS[view].title}</h1>
              <p className="mt-1 text-sm text-muted">{VIEWS[view].subtitle}</p>
            </header>
            <FilterBar view={view} filters={filters} onFilters={setFilters} dates={dates} onDates={setDates} admins={admins} />
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                data-testid={`view-${view}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {view === "leads" ? (
                  <Leads range={range} filters={filters} admins={admins} />
                ) : view === "inquiries" ? (
                  <Inquiries range={range} filters={filters} />
                ) : (
                  <Openings range={range} filters={filters} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
