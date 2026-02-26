import { useState } from "react";
import { quickStart } from "../lib/supabase";

type DesignVariantPageProps = {
  variant: 1;
};

function DesignVariantPage({ variant }: DesignVariantPageProps) {
  const [query, setQuery] = useState("");

  const onDashboard = () => {
    void quickStart("dashboard", query.trim());
  };

  const onRegister = () => {
    void quickStart("register", query.trim());
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-deep p-4 text-sand">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_15%,rgba(72,242,194,0.2),transparent_34%),radial-gradient(circle_at_88%_86%,rgba(72,242,194,0.14),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(240,231,213,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(240,231,213,0.12)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-5xl items-center">
        <section className="w-full rounded-[2rem] border border-mint/25 bg-slateBlue/45 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur md:p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-mint">Route /{variant}</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl leading-[0.96] md:text-6xl">
            VeturaIme: historiku i veturës në një vend
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-sand/85 md:text-base">
            Jep targën ose VIN-in dhe kalon direkt në dashboard me një rrjedhë të shpejtë.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onDashboard();
                }
              }}
              placeholder="p.sh. 01-234-AB ose VIN-i"
              className="h-12 rounded-xl border border-mint/35 bg-sand px-3 text-deep outline-none ring-mint/35 transition focus:ring"
            />
            <button
              type="button"
              onClick={onDashboard}
              className="h-12 rounded-xl bg-mint px-4 font-bold text-deep transition duration-300 hover:-translate-y-0.5"
            >
              Shko në Dashboard
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="h-12 rounded-xl border border-mint/40 px-4 font-semibold text-mint transition duration-300 hover:bg-mint/10"
            >
              Regjistro veturë
            </button>
          </div>

          <div className="mt-5 text-xs uppercase tracking-[0.18em] text-sand/65">
            një rrugë • një fokus • hyrje e shpejtë
          </div>
        </section>
      </div>
    </main>
  );
}

export default DesignVariantPage;
