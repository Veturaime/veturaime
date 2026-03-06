import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  generateVerificationCode,
  hasCompletedOnboarding,
  isEmailVerified,
  supabase,
  verifyCode
} from "../lib/supabase";

function VerificationPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Guard and generate code on mount
  useEffect(() => {
    let isMounted = true;

    const initVerification = async () => {
      try {
        const { data } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (!data.user) {
          navigate("/login", { replace: true });
          return;
        }

        setUserEmail(data.user.email ?? null);

        // Check if already verified
        const verified = await isEmailVerified();
        if (verified) {
          const onboarded = await hasCompletedOnboarding();
          navigate(onboarded ? "/my-garage" : "/onboarding", { replace: true });
          return;
        }

        // Generate verification code
        setLoading(true);
        const newCode = await generateVerificationCode();
        if (isMounted) {
          setGeneratedCode(newCode);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize verification.");
          setLoading(false);
        }
      }
    };

    void initVerification();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleInputChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    setCode((prev) => {
      const newCode = [...prev];
      newCode[index] = digit;
      return newCode;
    });

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowRight" && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [code]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (pastedData.length > 0) {
      const newCode = [...pastedData.split(""), ...Array(6 - pastedData.length).fill("")];
      setCode(newCode);

      // Focus the next empty input or last input
      const nextEmptyIndex = newCode.findIndex((digit) => !digit);
      const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
      inputRefs.current[focusIndex]?.focus();
    }
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Ju lutem vendosni kodin 6-shifror.");
      return;
    }

    setVerifying(true);

    try {
      const isValid = await verifyCode(fullCode);

      if (!isValid) {
        setError("Kodi nuk është i saktë ose ka skaduar. Provoni përsëri.");
        setVerifying(false);
        return;
      }

      setSuccess(true);

      // Brief success animation before redirect
      setTimeout(async () => {
        const onboarded = await hasCompletedOnboarding();
        navigate(onboarded ? "/my-garage" : "/onboarding", { replace: true });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikimi dështoi.");
      setVerifying(false);
    }
  };

  const onResendCode = async () => {
    if (resendCooldown > 0) return;

    setError("");
    setLoading(true);

    try {
      const newCode = await generateVerificationCode();
      setGeneratedCode(newCode);
      setResendCooldown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dërgimi i kodit të ri dështoi.");
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-deep px-4 py-10 font-body text-white antialiased">
      {/* Premium dark gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(72,242,194,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(20,39,58,0.4),transparent_50%)]" />

      {/* Animated grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }}
      />

      <section className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-mint/20 to-mint/5 shadow-[0_0_40px_rgba(72,242,194,0.15)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-8 w-8 text-mint"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Verifikimi i Llogarisë</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Kemi dërguar një kod 6-shifror te{" "}
            <span className="font-medium text-mint">{userEmail || "email-i juaj"}</span>
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur-xl md:p-8">
          {/* Demo mode notice */}
          {generatedCode && (
            <div className="mb-6 rounded-2xl border border-mint/20 bg-mint/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint/20">
                  <svg className="h-4 w-4 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-mint">Demo Mode</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Kodi juaj i verifikimit:{" "}
                    <span className="rounded bg-deep/50 px-2 py-0.5 font-mono font-bold tracking-wider text-white">
                      {generatedCode}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit}>
            {/* Code input grid */}
            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={loading || verifying || success}
                  className={`h-14 w-11 rounded-xl border bg-deep/50 text-center font-mono text-2xl font-bold transition-all duration-200 focus:outline-none sm:h-16 sm:w-14 ${
                    success
                      ? "border-mint/50 bg-mint/10 text-mint"
                      : digit
                        ? "border-mint/40 text-white ring-2 ring-mint/20"
                        : "border-white/10 text-white hover:border-white/20 focus:border-mint/50 focus:ring-2 focus:ring-mint/30"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-medium text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-semibold text-mint">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Verifikimi u krye me sukses!
              </div>
            )}

            <button
              type="submit"
              disabled={code.join("").length !== 6 || loading || verifying || success}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint to-emerald-400 font-bold text-deep shadow-[0_10px_40px_rgba(72,242,194,0.25)] transition-all duration-200 hover:shadow-[0_15px_50px_rgba(72,242,194,0.35)] disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-600 disabled:text-slate-400 disabled:shadow-none"
            >
              {verifying ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Duke verifikuar...
                </>
              ) : success ? (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sukses!
                </>
              ) : (
                "Verifiko Kodin"
              )}
            </button>
          </form>

          {/* Resend code */}
          <div className="mt-6 border-t border-white/10 pt-6 text-center">
            <p className="text-sm text-slate-400">Nuk e morët kodin?</p>
            <button
              type="button"
              onClick={onResendCode}
              disabled={resendCooldown > 0 || loading || verifying || success}
              className="mt-2 text-sm font-semibold text-mint transition hover:text-mint/80 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {resendCooldown > 0 ? `Provo përsëri pas ${resendCooldown}s` : "Dërgo kodin përsëri"}
            </button>
          </div>
        </div>

        {/* Sign out option */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onSignOut}
            className="text-sm text-slate-500 transition hover:text-slate-300"
          >
            Hyr me llogari tjetër
          </button>
        </div>
      </section>
    </main>
  );
}

export default VerificationPage;
