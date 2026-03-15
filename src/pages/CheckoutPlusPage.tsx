import { Link, useNavigate } from "react-router-dom";
import brandLogo from "../../assets/foto.png";
import { plans } from "../lib/plans";

function CheckoutPlusPage() {
  const navigate = useNavigate();
  const plusPlan = plans.plus;

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-4 py-10 font-body text-deep antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(72,242,194,0.14),transparent_36%),radial-gradient(circle_at_88%_12%,rgba(20,39,58,0.07),transparent_34%),linear-gradient(180deg,rgba(31,100,136,0.03),rgba(255,255,255,0))]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[1.8rem] border border-deep/10 bg-white/90 px-5 py-4 shadow-[0_18px_48px_rgba(20,39,58,0.08)] backdrop-blur-sm md:px-7">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ui-interactive inline-flex items-center gap-2 text-sm font-semibold text-slateBlue transition hover:underline"
          >
            ← Kthehu mbrapa
          </button>

          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl ring-1 ring-mint/35">
              <img src={brandLogo} alt="VeturaIme logo" className="h-full w-full bg-white object-contain p-0.5" />
            </div>
            <div>
              <p className="font-display text-lg leading-none text-slateBlue">VeturaIme</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deep/55">Checkout</p>
            </div>
          </Link>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <article className="rounded-[2rem] border border-deep/10 bg-white p-6 shadow-[0_24px_60px_rgba(20,39,58,0.10)] md:p-8">
            <span className="inline-flex rounded-full bg-mint px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-deep">
              Më i zgjedhuri
            </span>
            <h1 className="mt-5 max-w-2xl font-display text-5xl leading-[0.95] tracking-[-0.03em] text-slateBlue md:text-6xl">
              Aktivizo {plusPlan.name} dhe vazhdo me regjistrim.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-deep/72 md:text-lg">
              Kjo faqe e konfirmon zgjedhjen tënde për planin vjetor. Nuk ka pagesë reale ende, por profili yt do të
              krijohet me statusin {plusPlan.status} sapo ta përfundosh regjistrimin.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {plusPlan.features.map((feature) => (
                <div
                  key={feature}
                  className="rounded-[1.4rem] border border-deep/10 bg-slateBlue/5 px-4 py-4 text-sm font-medium text-deep/78 shadow-[0_10px_24px_rgba(20,39,58,0.05)]"
                >
                  <span className="mr-2 text-slateBlue">✔</span>
                  {feature}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.6rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              Pagesa online nuk është integruar ende. Në këtë fazë po ndërtojmë checkout flow-in dhe ruajtjen e planit
              në profil, që integrimi i pagesës të lidhet më pas pa ndryshuar rrjedhën e përdoruesit.
            </div>
          </article>

          <aside className="rounded-[2rem] border border-slateBlue/15 bg-[linear-gradient(180deg,rgba(31,100,136,0.06),rgba(72,242,194,0.08))] p-6 shadow-[0_24px_60px_rgba(20,39,58,0.10)] md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slateBlue">Përmbledhje</p>
            <h2 className="mt-3 font-display text-3xl text-deep">{plusPlan.name}</h2>
            <div className="mt-6 rounded-[1.5rem] border border-white/60 bg-white/90 p-5 shadow-[0_14px_30px_rgba(20,39,58,0.08)]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-deep/60">Çmimi</p>
                  <p className="mt-1 font-display text-5xl text-slateBlue">{plusPlan.priceLabel}</p>
                </div>
                <p className="rounded-full border border-mint/45 bg-mint/10 px-3 py-1 text-xs font-semibold text-deep">
                  {plusPlan.durationLabel}
                </p>
              </div>

              <div className="mt-6 space-y-3 text-sm text-deep/72">
                <p>Pas klikimit më poshtë, do të kalosh te regjistrimi me planin e parapërzgjedhur.</p>
                <p>Pas krijimit të llogarisë, `plan_status` do të ruhet si {plusPlan.status} në profilin tënd.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/register?plan=plus")}
              className="ui-interactive mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slateBlue px-5 text-base font-bold text-white shadow-[0_16px_36px_rgba(31,100,136,0.30)] transition hover:bg-deep"
            >
              Vazhdo me regjistrim
            </button>

            <Link
              to="/#pagesa"
              className="ui-interactive mt-3 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slateBlue/20 bg-white/70 px-5 text-sm font-semibold text-slateBlue transition hover:bg-white"
            >
              Kthehu te paketat
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default CheckoutPlusPage;