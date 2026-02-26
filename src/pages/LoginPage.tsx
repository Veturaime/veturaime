import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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

      navigate("/dashboard");
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
    <main className="min-h-screen bg-white px-4 py-10 font-body text-deep">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-deep/10 bg-white p-6 shadow-[0_20px_60px_rgba(20,39,58,0.12)] md:p-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slateBlue transition hover:underline"
        >
          ← Kthehu mbrapa
        </button>

        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slateBlue text-mint">
          <span className="text-2xl">🛡</span>
        </div>

        <h1 className="mt-5 text-center font-display text-4xl text-slateBlue">Mirë se u ktheve</h1>
        <p className="mt-2 text-center text-sm text-deep/70">Hyr dhe vazhdo menaxhimin aty ku e le.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-deep/85">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 outline-none ring-mint/40 transition focus:ring"
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
                className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 pr-12 outline-none ring-mint/40 transition focus:ring"
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slateBlue"
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
            <button type="button" className="text-sm font-semibold text-slateBlue hover:underline">
              E harrove fjalëkalimin?
            </button>
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="h-12 w-full rounded-xl bg-slateBlue font-bold text-white transition hover:bg-deep disabled:cursor-not-allowed disabled:bg-slateBlue/50"
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
