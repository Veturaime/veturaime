import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasCompletedOnboarding, saveOnboardingAnswers, supabase, type OnboardingAnswers } from "../lib/supabase";

const questionOptions = {
  transmission_preference: ["Manual", "Automatik"],
  car_body_preference: ["Sedan", "SUV", "Hatchback"],
  car_style_preference: ["Sportive", "Familjare"],
  fuel_consumption_priority: ["Pak", "Mesatare", "Shumë"],
  electric_future_preference: ["Po", "Jo", "Ndoshta"]
} as const;

const questions = [
  {
    key: "transmission_preference",
    text: "Manual apo automatik?"
  },
  {
    key: "car_body_preference",
    text: "Sedan, SUV apo hatchback?"
  },
  {
    key: "car_style_preference",
    text: "A preferon makina sportive apo familjare?"
  },
  {
    key: "fuel_consumption_priority",
    text: "Sa rëndësi ka për ty konsumi i karburantit?"
  },
  {
    key: "electric_future_preference",
    text: "A do të kalosh në makinë elektrike në të ardhmen?"
  }
] as const;

const initialAnswers: OnboardingAnswers = {
  transmission_preference: null,
  car_body_preference: null,
  car_style_preference: null,
  fuel_consumption_priority: null,
  electric_future_preference: null
};

function OnboardingPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const guardOnboarding = async () => {
      const { data } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!data.user) {
        navigate("/login", { replace: true });
        return;
      }

      const completed = await hasCompletedOnboarding();

      if (!isMounted) {
        return;
      }

      if (completed) {
        navigate("/dashboard", { replace: true });
      }
    };

    void guardOnboarding();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(Boolean).length;
  }, [answers]);

  const setAnswer = (key: keyof OnboardingAnswers, value: string | null) => {
    setAnswers((previous) => ({ ...previous, [key]: value }));
  };

  const onSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      await saveOnboardingAnswers(answers);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Ruajtja e përgjigjeve dështoi. Provo përsëri.");
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

    navigate("/login", { replace: true });
  };

  const onSkipAll = async () => {
    setError("");
    setLoading(true);

    try {
      await saveOnboardingAnswers(initialAnswers);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Ruajtja e skip dështoi. Provo përsëri.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-4 py-10 font-body text-deep antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(72,242,194,0.12),transparent_36%),radial-gradient(circle_at_88%_14%,rgba(20,39,58,0.07),transparent_36%)]" />
      <section className="relative mx-auto w-full max-w-3xl rounded-3xl border border-deep/10 bg-white/95 p-6 shadow-[0_28px_80px_rgba(20,39,58,0.14)] backdrop-blur-sm md:p-8">
        <p className="text-sm font-semibold text-slateBlue">Hapi i personalizimit</p>
        <h1 className="mt-2 font-display text-3xl tracking-[-0.02em] text-slateBlue">5 pyetje të shpejta</h1>
        <p className="mt-2 text-sm text-deep/70">Mund të përgjigjesh ose të bësh skip për secilën pyetje.</p>
        <p className="mt-2 text-xs font-semibold text-deep/60">Përgjigjur: {answeredCount}/5</p>

        <div className="mt-6 space-y-4">
          {questions.map((question, index) => {
            const selected = answers[question.key];

            return (
              <article key={question.key} className="rounded-2xl border border-deep/10 bg-white p-4">
                <p className="text-sm font-semibold text-deep/80">Pyetja {index + 1}</p>
                <h2 className="mt-1 text-base font-bold text-slateBlue">{question.text}</h2>

                <div className="mt-3 flex flex-wrap gap-2">
                  {questionOptions[question.key].map((option) => {
                    const isSelected = selected === option;

                    return (
                      <button
                        type="button"
                        key={option}
                        onClick={() => setAnswer(question.key, option)}
                        className={`ui-interactive rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? "border-slateBlue bg-slateBlue text-white"
                            : "border-deep/15 bg-white text-deep hover:border-slateBlue/45"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setAnswer(question.key, null)}
                    className="ui-interactive rounded-xl border border-deep/15 bg-white px-3 py-2 text-sm font-semibold text-deep/80 hover:border-slateBlue/45"
                  >
                    Skip
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="ui-interactive mt-6 h-12 w-full rounded-xl bg-slateBlue font-bold text-white shadow-[0_14px_36px_rgba(31,100,136,0.32)] transition hover:bg-deep disabled:cursor-not-allowed disabled:bg-slateBlue/50 disabled:shadow-none"
        >
          {loading ? "Duke ruajtur..." : "Vazhdo në Dashboard"}
        </button>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="ui-interactive h-11 rounded-xl border border-deep/20 bg-white font-semibold text-deep transition hover:border-slateBlue/45 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Kthehu mbrapa
          </button>
          <button
            type="button"
            onClick={onSkipAll}
            disabled={loading}
            className="ui-interactive h-11 rounded-xl border border-deep/20 bg-white font-semibold text-deep transition hover:border-slateBlue/45 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Bëje Skip
          </button>
        </div>
      </section>
    </main>
  );
}

export default OnboardingPage;
