"use client";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Orbit,
  Sparkle,
} from "lucide-react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  return (
    <main className="access">
      <section className="atlas">
        <div className="wordmark">
          <Sparkle /> STAR SYSTEM
        </div>
        <div className="sky" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((n) => (
            <i
              key={n}
              style={{
                width: 30 + n * 13 + "%",
                height: 30 + n * 13 + "%",
                transform: "rotate(" + (-35 + n * 17) + "deg)",
              }}
            >
              <b />
            </i>
          ))}
          <Orbit className="sky-core" />
        </div>
        <div className="caption">
          <small>SINCERE ACADEMY</small>
          <h1>
            Attendance <em>&amp;</em>
            <br />
            recognition.
          </h1>
        </div>
      </section>
      <section className="accessform">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const body = Object.fromEntries(new FormData(e.currentTarget));
              const r = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              if (!r.ok) throw Error((await r.json()).error);
              location.replace("/dashboard");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Unable to sign in.",
              );
              setBusy(false);
            }
          }}
        >
          <KeyRound className="accent" />
          <h2>Staff sign in</h2>
          <label>
            Email address
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password
            <span className="password">
              <input
                name="password"
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={17} />
          </button>
          <footer>For account access, contact the academy owner.</footer>
        </form>
      </section>
    </main>
  );
}
