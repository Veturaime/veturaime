import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithEmail } from "../lib/supabase";

type RegisterForm = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

const initialForm: RegisterForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false
};

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isValid = useMemo(() => {
    return (
      form.fullName.trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(form.email) &&
      form.password.length >= 8 &&
      form.password === form.confirmPassword &&
      form.acceptTerms
    );
  }, [form]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isValid) {
      setError("Kontrollo fushat dhe prano kushtet para se të vazhdosh.");
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail({
        fullName: form.fullName,
        email: form.email,
        password: form.password
      });

      setMessage("Llogaria u krijua. Kontrollo email-in për konfirmim.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Regjistrimi dështoi. Provo përsëri.");
      }
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

        <h1 className="mt-5 text-center font-display text-4xl text-slateBlue">Krijo llogarinë</h1>
        <p className="mt-2 text-center text-sm text-deep/70">Nis menaxhimin e veturës në mënyrë të organizuar.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-deep/85">Emri i plotë</label>
            <input
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 outline-none ring-mint/40 transition focus:ring"
              placeholder="Emri Mbiemri"
              required
            />
          </div>

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

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-deep/85">Përsërite fjalëkalimin</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                className="h-12 w-full rounded-xl border border-deep/15 bg-white px-3 pr-12 outline-none ring-mint/40 transition focus:ring"
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slateBlue"
              >
                {showConfirmPassword ? "Fshi" : "Shfaq"}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-deep/80">
            <input
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(event) => setForm((prev) => ({ ...prev, acceptTerms: event.target.checked }))}
              className="h-4 w-4 rounded border-deep/30 text-slateBlue focus:ring-slateBlue"
            />
            Pajtohem me kushtet dhe privatësinë
          </label>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-emerald-600">{message}</p> : null}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="h-12 w-full rounded-xl bg-slateBlue font-bold text-white transition hover:bg-deep disabled:cursor-not-allowed disabled:bg-slateBlue/50"
          >
            {loading ? "Duke krijuar llogarinë..." : "Krijo llogari"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-deep/70">
          Ke llogari ekzistuese?{" "}
          <Link to="/login" className="font-semibold text-slateBlue underline-offset-2 hover:underline">
            Hyr
          </Link>
        </p>
      </div>
    </main>
  );
}

export default RegisterPage;
