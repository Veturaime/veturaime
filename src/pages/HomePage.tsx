import { useState } from "react";
import { Link } from "react-router-dom";
import carShowcaseImage from "../../assets/blue-sports-car-.jpg";
import brandLogo from "../../assets/logo.jpg";

const quickCards = [
  {
    title: "Serviset & Riparimet",
    desc: "Ruaj historikun e servisimeve dhe koston e secilit intervenim."
  },
  {
    title: "Dokumentet",
    desc: "Mbaj afatet e regjistrimit, sigurimit dhe kontrollit teknik në një vend."
  },
  {
    title: "Shpenzimet",
    desc: "Shiko sa të kushton vetura në muaj me raport të qartë dhe të shpejtë."
  }
];

const steps = [
  {
    number: "01",
    title: "Krijo llogarinë",
    desc: "Regjistrohu për pak sekonda dhe aktivizo profilin tënd personal."
  },
  {
    number: "02",
    title: "Shto veturën",
    desc: "Vendos targën, kilometrat dhe të dhënat bazë për menaxhim të saktë."
  },
  {
    number: "03",
    title: "Ndjek historikun",
    desc: "Regjistro shërbimet, dokumentet dhe kostot nga paneli yt."
  }
];

const faqs = [
  {
    q: "A mund të përdor VeturaIme për më shumë se një veturë?",
    a: "Po. Mund të shtosh disa vetura brenda profilit dhe secila ka historikun e vet të ndarë."
  },
  {
    q: "A mund të regjistroj servisimet e kaluara?",
    a: "Po, mund t’i shtosh edhe retroaktivisht për të pasur historik të plotë të mirëmbajtjes."
  },
  {
    q: "A i ruan VeturaIme të dhënat e mia në mënyrë të sigurt?",
    a: "Po, autentikimi dhe të dhënat menaxhohen me Supabase dhe sesioni yt mbrohet me kredencialet e tua."
  },
  {
    q: "Sa kohë duhet për ta nisur përdorimin?",
    a: "Më pak se 2 minuta: krijon llogarinë, hyn në panel dhe nis të shtosh të dhënat e veturës."
  }
];

function HomePage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white font-body text-deep antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(72,242,194,0.12),transparent_36%),radial-gradient(circle_at_88%_14%,rgba(20,39,58,0.07),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(20,39,58,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(20,39,58,0.08)_1px,transparent_1px)] [background-size:32px_32px]" />

      <header className="sticky top-0 z-30 border-b border-deep/10 bg-white/90 shadow-[0_10px_30px_rgba(20,39,58,0.05)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:h-16 md:flex-nowrap md:gap-0 md:px-8 md:py-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-xl ring-1 ring-mint/35">
              <img src={brandLogo} alt="VeturaIme logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-display text-lg leading-none">VeturaIme</p>
            </div>
          </div>

          <nav className="order-3 flex w-full items-center justify-center gap-7 border-t border-deep/10 pt-2 text-sm font-semibold tracking-[0.01em] text-deep/80 md:order-none md:w-auto md:border-t-0 md:pt-0">
            <a href="#ballina" className="ui-interactive transition hover:text-slateBlue">
              Ballina
            </a>
            <a href="#si-funksionon" className="ui-interactive transition hover:text-slateBlue">
              Si funksionon
            </a>
            <a href="#pagesa" className="ui-interactive transition hover:text-slateBlue">
              Pagesa
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/register"
              className="ui-interactive inline-flex rounded-full border border-slateBlue/20 px-3 py-2 text-xs font-semibold text-slateBlue transition hover:border-slateBlue/35 hover:bg-slateBlue/5"
            >
              Regjistrohu falas
            </Link>
            <Link
              to="/login"
              className="ui-interactive inline-flex h-10 items-center justify-center rounded-xl bg-mint px-4 text-sm font-bold text-deep shadow-[0_12px_30px_rgba(72,242,194,0.35)] transition hover:-translate-y-0.5 hover:brightness-95"
            >
              Hyr
            </Link>
          </div>
        </div>
      </header>

      <section id="ballina" className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-12 text-center md:px-8 md:pt-20 lg:pb-24">
        <h1 className="mx-auto mt-9 max-w-5xl font-display text-5xl leading-[0.95] tracking-[-0.02em] text-slateBlue md:text-7xl">
          Menaxho veturën pa stres dhe pa kaos.
        </h1>

        <p className="mt-9 text-sm font-semibold uppercase tracking-[0.28em] text-slateBlue md:text-base">
          Të gjitha të dhënat në një vend
        </p>

        <p className="mx-auto mt-6 max-w-4xl text-xl leading-relaxed text-deep/70 md:text-[2rem]">
          Ruaj servisimet, dokumentet dhe shpenzimet në një panel të vetëm. Hyr shpejt, gjej historikun e
          saktë dhe mos humb më afate të rëndësishme.
        </p>

        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-4">
            <button
              type="button"
            className="ui-interactive inline-flex h-11 min-w-[170px] items-center justify-center rounded-2xl border border-mint/45 bg-mint/10 px-5 text-base font-semibold text-slateBlue shadow-[0_14px_28px_rgba(72,242,194,0.18)] transition hover:-translate-y-0.5 hover:bg-mint/20 md:h-14 md:min-w-[220px] md:px-7 md:text-xl"
          >
            Permbajtja
            </button>
        </div>

        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2 text-xs font-semibold text-deep/75 md:text-sm">
          <span className="rounded-full border border-slateBlue/20 bg-white/85 px-3 py-1">Sinkronizim i sigurt</span>
          <span className="rounded-full border border-mint/50 bg-mint/10 px-3 py-1">Setup në &lt; 2 minuta</span>
          <span className="rounded-full border border-slateBlue/20 bg-white/85 px-3 py-1">Historik i qartë</span>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 md:px-8 md:pb-16">
        <div className="rounded-[1.6rem] border border-deep/10 bg-white/75 p-3 shadow-[0_24px_60px_rgba(20,39,58,0.1)] backdrop-blur-sm sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 sm:gap-6">
          <div className="min-w-0">
            <img
              src={carShowcaseImage}
              alt="Veturë sportive blu"
              className="h-[220px] w-full rounded-[1.1rem] border border-deep/10 object-cover shadow-[0_28px_70px_rgba(20,39,58,0.18)] sm:h-[330px] sm:rounded-[1.5rem] md:h-[390px]"
            />
          </div>

          <div className="grid min-w-0 gap-3 sm:gap-4">
            {quickCards.map((card, index) => (
              <article key={card.title} className={`ui-interactive min-w-0 rounded-[1rem] border p-3 shadow-[0_12px_30px_rgba(20,39,58,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(20,39,58,0.1)] sm:rounded-[1.4rem] sm:p-6 ${index === 1 ? "border-mint/40 bg-mint/10" : "border-deep/10 bg-white/95"}`}>
                <h3 className="font-display text-[1.05rem] leading-tight text-slateBlue sm:text-2xl">{card.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-deep/75 sm:mt-3 sm:text-sm">{card.desc}</p>
              </article>
            ))}
          </div>
          </div>
        </div>
      </section>

      <section id="si-funksionon" className="relative z-10 bg-slateBlue/5 py-16 text-deep md:py-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slateBlue/25 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slateBlue/20 to-transparent" />
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <div className="text-center">
            <h2 className="font-display text-5xl md:text-6xl">Si funksionon VeturaIme</h2>
            <p className="mx-auto mt-3 max-w-2xl text-deep/70">3 hapa të qartë për të menaxhuar veturën pa kaos.</p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.number} className="ui-interactive rounded-[1.4rem] border border-deep/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,39,58,0.08)] transition hover:-translate-y-1 hover:border-slateBlue/20 hover:shadow-[0_22px_50px_rgba(20,39,58,0.12)]">
                <div className="inline-flex rounded-full bg-slateBlue px-3 py-1 text-xs font-semibold tracking-[0.16em] text-mint">
                  {step.number}
                </div>
                <h3 className="mt-4 font-display text-2xl leading-tight">{step.title}</h3>
                <p className="mt-3 text-sm text-deep/70">{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="relative z-10 mx-auto w-full max-w-5xl px-4 py-16 md:py-24">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mint">Pyetje të shpeshta</p>
          <h2 className="mt-3 font-display text-5xl md:text-6xl">Çfarë duhet të dish</h2>
        </div>

        <div className="mt-10 divide-y divide-deep/10 rounded-[1.4rem] border border-deep/10 bg-white shadow-[0_18px_48px_rgba(20,39,58,0.08)]">
          {faqs.map((faq, index) => {
            const opened = openFaq === index;

            return (
              <article key={faq.q} className="px-5 py-5 md:px-7">
                <button
                  type="button"
                  className="ui-interactive flex w-full items-start justify-between gap-4 text-left transition hover:text-slateBlue"
                  onClick={() => setOpenFaq(opened ? -1 : index)}
                >
                  <span className="font-semibold text-slateBlue">{faq.q}</span>
                  <span className={`text-xl leading-none transition ${opened ? "text-slateBlue" : "text-mint"}`}>{opened ? "−" : "+"}</span>
                </button>
                {opened ? <p className="mt-3 max-w-3xl text-sm text-deep/75">{faq.a}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section id="pagesa" className="relative z-10 border-t border-deep/10 bg-slateBlue/5 py-16 md:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mint">Pagesa</p>
            <h2 className="mt-3 font-display text-5xl text-slateBlue md:text-6xl">Paketat</h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 items-stretch gap-3 sm:gap-5">
            <article className="ui-interactive flex h-full flex-col rounded-[1rem] border border-deep/10 bg-white p-3 shadow-[0_14px_35px_rgba(20,39,58,0.10)] transition hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(20,39,58,0.14)] sm:rounded-[1.2rem] sm:p-6">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 rounded-full bg-slateBlue" />
                <p className="text-xs font-semibold text-slateBlue sm:text-sm">Plani Bazë</p>
              </div>

              <h3 className="mt-3 font-display text-3xl text-deep sm:mt-4 sm:text-4xl">0€</h3>
              <p className="mt-1 text-[11px] text-deep/65 sm:text-xs">1 muaj falas</p>

              <ul className="mt-4 flex-1 space-y-2 text-[11px] text-deep/80 sm:mt-5 sm:text-sm">
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Shërbime bazë për menaxhim</span></li>
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Ruajtje e dokumenteve kryesore</span></li>
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Përllogaritje e thjeshtë e shpenzimeve</span></li>
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Mbështetje standarde</span></li>
              </ul>

              <button
                type="button"
                className="ui-interactive mt-5 inline-flex h-9 w-full items-center justify-center rounded-full border border-slateBlue/35 px-2 text-xs font-semibold text-slateBlue transition hover:bg-slateBlue/5 sm:mt-6 sm:h-10 sm:text-sm"
              >
                Fillo tani
              </button>
            </article>

            <article className="ui-interactive relative flex h-full flex-col rounded-[1rem] border border-slateBlue/25 bg-white p-3 shadow-[0_14px_35px_rgba(20,39,58,0.12)] transition hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(20,39,58,0.16)] sm:rounded-[1.2rem] sm:p-6">
              <span className="absolute -top-2.5 right-3 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-deep sm:text-[11px]">
                Më i zgjedhuri
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 rounded-full bg-slateBlue" />
                <p className="text-xs font-semibold text-slateBlue sm:text-sm">Bazë Plus</p>
              </div>

              <h3 className="mt-3 font-display text-3xl text-deep sm:mt-4 sm:text-4xl">10€</h3>
              <p className="mt-1 text-[11px] text-deep/65 sm:text-xs">1 vit</p>

              <ul className="mt-4 flex-1 space-y-2 text-[11px] text-deep/80 sm:mt-5 sm:text-sm">
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Të gjitha veçoritë e Basic</span></li>
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Njoftime të avancuara për afate</span></li>
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Raporte më të detajuara mujore</span></li>
                <li className="flex items-start gap-1.5 sm:gap-2"><span className="text-slateBlue">✔</span><span>Mbështetje prioritare</span></li>
              </ul>

              <button
                type="button"
                className="ui-interactive mt-5 inline-flex h-9 w-full items-center justify-center rounded-full bg-slateBlue px-2 text-xs font-semibold text-white transition hover:bg-deep sm:mt-6 sm:h-10 sm:text-sm"
              >
                Fillo tani
              </button>
            </article>
          </div>

          <p className="mt-4 text-center text-xs font-semibold text-deep/65 sm:text-sm">Pa kontratë afatgjatë • Ndërprerje kur të duash</p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-deep/10 bg-gradient-to-br from-slateBlue/10 via-white to-mint/10 py-12">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <div className="rounded-[1.4rem] border border-slateBlue/15 bg-white/85 p-5 shadow-[0_16px_45px_rgba(20,39,58,0.10)] backdrop-blur-sm sm:p-7">
            <div className="grid gap-8 text-center sm:text-left md:grid-cols-3">
              <div>
                <p className="font-display text-2xl text-slateBlue">VeturaIme</p>
                <p className="mx-auto mt-2 max-w-xs text-sm text-deep/70 sm:mx-0">
              Menaxhim i thjeshtë i veturës me historik, dokumente dhe kosto në një vend.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slateBlue">Linqe të shpejta</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <a href="#ballina" className="ui-interactive rounded-full border border-slateBlue/20 bg-slateBlue/5 px-3 py-1.5 text-sm text-slateBlue transition hover:bg-slateBlue/10">Ballina</a>
                  <a href="#si-funksionon" className="ui-interactive rounded-full border border-mint/45 bg-mint/10 px-3 py-1.5 text-sm text-deep transition hover:bg-mint/20">Si funksionon</a>
                  <a href="#pagesa" className="ui-interactive rounded-full border border-slateBlue/20 bg-slateBlue/5 px-3 py-1.5 text-sm text-slateBlue transition hover:bg-slateBlue/10">Pagesa</a>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slateBlue">Na ndiq</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" className="ui-interactive rounded-full border border-slateBlue/20 bg-slateBlue/5 px-3 py-1.5 text-sm text-slateBlue transition hover:bg-slateBlue/10">
                    Instagram
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="ui-interactive rounded-full border border-slateBlue/20 bg-slateBlue/5 px-3 py-1.5 text-sm text-slateBlue transition hover:bg-slateBlue/10">
                    LinkedIn
                  </a>
                  <a href="mailto:info@veturaime.com" className="ui-interactive rounded-full border border-mint/45 bg-mint/10 px-3 py-1.5 text-sm text-deep transition hover:bg-mint/20">
                    info@veturaime.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-deep/10 pt-5 text-center text-xs text-deep/60">
            © {new Date().getFullYear()} VeturaIme. Të gjitha të drejtat e rezervuara.
          </div>
        </div>
      </footer>
    </main>
  );
}

export default HomePage;
