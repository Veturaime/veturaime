import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasCompletedOnboarding, hasCompletedCarSelection, isEmailVerified, supabase } from "../lib/supabase";

type LoginForm = {
  email: string;
  password: string;
};

const initialForm: LoginForm = {
  email: "",
  password: ""
};

function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid = useMemo(() => {
    return /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 8;
  }, [form]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isValid) {
      setError("Kontrollo email-in dhe fjalëkalimin para se të vazhdosh.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!remember) {
        await supabase.auth.signOut({ scope: "local" });
      }

      if (data.session?.access_token) {
        sessionStorage.setItem("veturaime_access_token", data.session.access_token);
      }

      // Determine where to redirect based on user state
      const emailVerified = await isEmailVerified();
      if (!emailVerified) {
        navigate("/verify");
        return;
      }

      const onboardingCompleted = await hasCompletedOnboarding();
      if (!onboardingCompleted) {
        navigate("/onboarding");
        return;
      }

      const hasCarSetup = await hasCompletedCarSelection();
      if (!hasCarSetup) {
        navigate("/car-setup");
        return;
      }

      navigate("/my-garage");
    } catch {
      setError("Identifikimi dështoi. Provo përsëri.");
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-4 py-10 font-body text-deep antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(72,242,194,0.12),transparent_36%),radial-gradient(circle_at_88%_14%,rgba(20,39,58,0.07),transparent_36%)]" />
      <div className="relative mx-auto w-full max-w-md rounded-3xl border border-deep/10 bg-white/95 p-6 shadow-[0_28px_80px_rgba(20,39,58,0.14)] backdrop-blur-sm md:p-8">
        <button
          type="button"
          onClick={onBack}
          className="ui-interactive inline-flex items-center gap-2 text-sm font-semibold text-slateBlue transition hover:underline"
        >
          ← Kthehu mbrapa
        </button>

        <div className="mx-auto mt-1 grid h-14 w-14 place-items-center rounded-2xl bg-slateBlue text-mint shadow-[0_10px_24px_rgba(31,100,136,0.28)]">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-center font-display text-4xl tracking-[-0.02em] text-slateBlue">Mirë se u ktheve</h1>
        <p className="mt-2 text-center text-sm text-deep/70">Hyr dhe vazhdo menaxhimin aty ku e le.</p>
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-deep/85">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 outline-none ring-mint/40 transition focus:border-slateBlue/30 focus:ring focus:ring-mint/35"
              placeholder="emri@shembull.com"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-deep/85">Fjalëkalimi</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 pr-12 outline-none ring-mint/40 transition focus:border-slateBlue/30 focus:ring focus:ring-mint/35"
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="ui-interactive absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slateBlue"
              >
                {showPassword ? "Fshi" : "Shfaq"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-deep/80">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-deep/30 text-slateBlue focus:ring-slateBlue"
              />
              Më maj në mend
            </label>
            <button type="button" className="ui-interactive text-sm font-semibold text-slateBlue hover:underline">
              E harrove fjalëkalimin?
            </button>
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="ui-interactive h-12 w-full rounded-xl bg-slateBlue font-bold text-white shadow-[0_14px_36px_rgba(31,100,136,0.32)] transition hover:bg-deep disabled:cursor-not-allowed disabled:bg-slateBlue/50 disabled:shadow-none"
          >
            {loading ? "Tu hi..." : "Hyr"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-deep/70">
          Nuk ke llogari?{" "}
          <Link to="/register" className="font-semibold text-slateBlue underline-offset-2 hover:underline">
            Regjistrohu
          </Link>
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
