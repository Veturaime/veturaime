import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import brandLogo from "../../assets/foto.png";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [isRecoveryFlow, setIsRecoveryFlow] = useState(() => {
    const queryMode = searchParams.get("mode") === "recovery" || searchParams.get("type") === "recovery";

    if (queryMode || typeof window === "undefined") {
      return queryMode;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hashParams.get("type") === "recovery";
  });

  const canSendReset = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const canUpdatePassword = useMemo(
    () => newPassword.length >= 8 && newPassword === confirmPassword,
    [newPassword, confirmPassword]
  );

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryFlow(true);
      }
    });

    const onHashChange = () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (hashParams.get("type") === "recovery") {
        setIsRecoveryFlow(true);
      }
    };

    window.addEventListener("hashchange", onHashChange);
    onHashChange();

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const onRequestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!canSendReset) {
      setError("Shkruaj një email të vlefshëm.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password?mode=recovery`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage("Të dërguam linkun për rikthim të fjalëkalimit në email.");
    } catch {
      setError("Nuk u dërgua linku. Provo përsëri.");
    } finally {
      setLoading(false);
    }
  };

  const onUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!canUpdatePassword) {
      setError("Fjalëkalimi duhet të ketë të paktën 8 karaktere dhe të përputhet.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage("Fjalëkalimi u ndryshua me sukses. Po të dërgojmë te hyrja...");
      setTimeout(() => navigate("/login"), 1200);
    } catch {
      setError("Nuk u përditësua fjalëkalimi. Provo përsëri.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-4 py-10 font-body text-deep antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(72,242,194,0.12),transparent_36%),radial-gradient(circle_at_86%_10%,rgba(20,39,58,0.07),transparent_36%)]" />
      <div className="relative mx-auto w-full max-w-md rounded-3xl border border-deep/10 bg-white/95 p-6 shadow-[0_28px_80px_rgba(20,39,58,0.14)] backdrop-blur-sm md:p-8">
        <Link to="/login" className="ui-interactive inline-flex items-center gap-2 text-sm font-semibold text-slateBlue hover:underline">
          ← Kthehu te hyrja
        </Link>

        <div className="mx-auto mt-1 h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-mint/35 shadow-[0_10px_24px_rgba(31,100,136,0.28)]">
          <img src={brandLogo} alt="VeturaIme logo" className="h-full w-full bg-white object-contain p-0.5" />
        </div>

        <h1 className="mt-5 text-center font-display text-3xl tracking-[-0.02em] text-slateBlue">
          {isRecoveryFlow ? "Vendos fjalëkalim të ri" : "Rikthe fjalëkalimin"}
        </h1>
        <p className="mt-2 text-center text-sm text-deep/70">
          {isRecoveryFlow
            ? "Shkruaj fjalëkalimin e ri për të vazhduar."
            : "Shkruaj email-in dhe do të të dërgojmë link për rikthim."}
        </p>

        {isRecoveryFlow ? (
          <form onSubmit={onUpdatePassword} className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-deep/85">Fjalëkalimi i ri</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 pr-12 text-base outline-none ring-mint/40 transition focus:border-slateBlue/30 focus:ring focus:ring-mint/35"
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="ui-interactive absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slateBlue"
                >
                  {showNewPassword ? "Fshi" : "Shfaq"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-deep/85">Përsërite fjalëkalimin e ri</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 pr-12 text-base outline-none ring-mint/40 transition focus:border-slateBlue/30 focus:ring focus:ring-mint/35"
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="ui-interactive absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slateBlue"
                >
                  {showConfirmPassword ? "Fshi" : "Shfaq"}
                </button>
              </div>
            </div>

            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            {message ? <p className="text-sm font-semibold text-emerald-600">{message}</p> : null}

            <button
              type="submit"
              disabled={!canUpdatePassword || loading}
              className="ui-interactive h-12 w-full rounded-xl bg-slateBlue font-bold text-white shadow-[0_14px_36px_rgba(31,100,136,0.32)] transition hover:bg-deep disabled:cursor-not-allowed disabled:bg-slateBlue/50 disabled:shadow-none"
            >
              {loading ? "Po ruhet..." : "Ruaj fjalëkalimin"}
            </button>
          </form>
        ) : (
          <form onSubmit={onRequestReset} className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-deep/85">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 text-base outline-none ring-mint/40 transition focus:border-slateBlue/30 focus:ring focus:ring-mint/35"
                placeholder="emri@shembull.com"
                required
              />
            </div>

            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            {message ? <p className="text-sm font-semibold text-emerald-600">{message}</p> : null}

            <button
              type="submit"
              disabled={!canSendReset || loading}
              className="ui-interactive h-12 w-full rounded-xl bg-slateBlue font-bold text-white shadow-[0_14px_36px_rgba(31,100,136,0.32)] transition hover:bg-deep disabled:cursor-not-allowed disabled:bg-slateBlue/50 disabled:shadow-none"
            >
              {loading ? "Po dërgohet..." : "Dërgo linkun"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default ResetPasswordPage;
