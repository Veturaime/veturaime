import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasCompletedOnboarding, saveOnboardingAnswers, supabase, type OnboardingAnswers } from "../lib/supabase";

type OnboardingStep = {
  key: keyof OnboardingAnswers;
  question: string;
  description: string;
  options: { value: string; label: string; icon: string }[];
};

const steps: OnboardingStep[] = [
  {
    key: "transmission_preference",
    question: "Çfarë transmisioni preferoni?",
    description: "Kjo na ndihmon të personalizojmë përvojën tuaj",
    options: [
      { value: "manual", label: "Manual", icon: "⚙️" },
      { value: "automatik", label: "Automatik", icon: "🔄" },
      { value: "both", label: "Të dyja", icon: "🔀" }
    ]
  },
  {
    key: "car_body_preference",
    question: "Çfarë tipi karoserie preferoni?",
    description: "Tipi i makinës që ju pëlqen më shumë",
    options: [
      { value: "sedan", label: "Sedan", icon: "🚗" },
      { value: "suv", label: "SUV", icon: "🚙" },
      { value: "hatchback", label: "Hatchback", icon: "🚘" },
      { value: "coupe", label: "Coupe", icon: "🏎️" },
      { value: "wagon", label: "Station Wagon", icon: "🚕" }
    ]
  },
  {
    key: "car_style_preference",
    question: "Si e përdorni makinën tuaj?",
    description: "Qëllimi kryesor i përdorimit",
    options: [
      { value: "family", label: "Familjare", icon: "👨‍👩‍👧‍👦" },
      { value: "sport", label: "Sportive", icon: "🏁" },
      { value: "business", label: "Biznes", icon: "💼" },
      { value: "daily", label: "Ditore", icon: "📅" },
      { value: "weekend", label: "Fundjavë", icon: "🌴" }
    ]
  },
  {
    key: "fuel_consumption_priority",
    question: "Sa rëndësi ka konsumi i karburantit?",
    description: "Prioriteti juaj për efikasitetin",
    options: [
      { value: "very_important", label: "Shumë e rëndësishme", icon: "💚" },
      { value: "moderate", label: "Mesatarisht", icon: "💛" },
      { value: "not_priority", label: "Jo prioritet", icon: "🔥" }
    ]
  },
  {
    key: "electric_future_preference",
    question: "A mendoni të kaloni në EV në të ardhmen?",
    description: "Plani juaj për makinë elektrike",
    options: [
      { value: "yes", label: "Po, patjetër", icon: "⚡" },
      { value: "maybe", label: "Ndoshta", icon: "🤔" },
      { value: "no", label: "Jo tani", icon: "⛽" },
      { value: "already", label: "Kam tashmë", icon: "🔋" }
    ]
  }
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    transmission_preference: null,
    car_body_preference: null,
    car_style_preference: null,
    fuel_consumption_priority: null,
    electric_future_preference: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const guardOnboarding = async () => {
      const { data } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (!data.user) {
        navigate("/login", { replace: true });
        return;
      }

      const completed = await hasCompletedOnboarding();

      if (!isMounted) return;

      if (completed) {
        navigate("/my-garage", { replace: true });
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

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const selectAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [step.key]: value }));
  };

  const nextStep = () => {
    if (isLastStep) {
      onSubmit();
    } else {
      setIsExiting(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsExiting(false);
      }, 200);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setIsExiting(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
        setIsExiting(false);
      }, 200);
    }
  };

  const skipStep = () => {
    setAnswers((prev) => ({ ...prev, [step.key]: null }));
    nextStep();
  };

  const onSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      await saveOnboardingAnswers(answers);
      navigate("/car-setup", { replace: true });
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

  const onSkipAll = async () => {
    setError("");
    setLoading(true);

    try {
      await saveOnboardingAnswers({
        transmission_preference: null,
        car_body_preference: null,
        car_style_preference: null,
        fuel_consumption_priority: null,
        electric_future_preference: null
      });
      navigate("/car-setup", { replace: true });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Skip dështoi. Provo përsëri.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-deep px-4 py-10 font-body text-white antialiased">
      {/* Premium gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(72,242,194,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(20,39,58,0.5),transparent_60%)]" />

      {/* Animated particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-mint/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mb-8 w-full max-w-lg">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Hapi {currentStep + 1} nga {steps.length}</span>
          <span>{answeredCount} përgjigje</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-mint to-emerald-400 transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main card */}
      <div
        className={`relative z-10 w-full max-w-lg transform transition-all duration-200 ${
          isExiting ? "translate-x-8 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl md:p-8">
          {/* Question header */}
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mint/20 to-mint/5 text-3xl">
              {step.options.find((o) => o.value === answers[step.key])?.icon || "❓"}
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">{step.question}</h2>
            <p className="mt-2 text-sm text-slate-400">{step.description}</p>
          </div>

          {/* Options grid */}
          <div className="mt-8 grid gap-3">
            {step.options.map((option) => {
              const isSelected = answers[step.key] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectAnswer(option.value)}
                  className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-mint/50 bg-mint/10 shadow-[0_0_20px_rgba(72,242,194,0.1)]"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-deep/50 text-2xl transition group-hover:scale-105">
                    {option.icon}
                  </span>
                  <span className="flex-1">
                    <span
                      className={`block font-semibold ${isSelected ? "text-mint" : "text-white"}`}
                    >
                      {option.label}
                    </span>
                  </span>
                  {isSelected && (
                    <svg className="h-6 w-6 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-medium text-red-300">
              {error}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={previousStep}
                disabled={loading}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Mbrapa
              </button>
            )}
            <button
              type="button"
              onClick={skipStep}
              disabled={loading}
              className="flex h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={nextStep}
              disabled={loading}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint to-emerald-400 font-bold text-deep shadow-[0_8px_30px_rgba(72,242,194,0.25)] transition hover:shadow-[0_12px_40px_rgba(72,242,194,0.35)] disabled:opacity-50"
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : isLastStep ? (
                "Përfundo"
              ) : (
                <>
                  Vazhdo
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Skip all button */}
      <button
        type="button"
        onClick={onSkipAll}
        disabled={loading}
        className="relative z-10 mt-6 text-sm text-slate-500 transition hover:text-slate-300 disabled:opacity-50"
      >
        Kalo të gjitha pyetjet
      </button>

      {/* Floating animation keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(-20px); opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}

export default OnboardingPage;
