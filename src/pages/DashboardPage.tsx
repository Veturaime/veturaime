import { Link, useLocation } from "react-router-dom";

function DashboardPage() {
  const location = useLocation();

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_20%,#1c2732,#0d1218)] p-4 text-slate-100">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-8 shadow-2xl">
        <p className="text-sm text-slate-400">VeturaIme</p>
        <h1 className="mt-2 text-3xl font-extrabold">Dashboard demonstrues</h1>
        <p className="mt-3 text-slate-300">
          Hyrja e shpejtë funksionoi. Parametrat aktualë janë:{" "}
          <span className="font-semibold text-cyan-300">{location.search || "(asnjë)"}</span>
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/" className="rounded-xl bg-mint px-4 py-2 font-bold text-deep">
            Kthehu te ballina
          </Link>
          <Link to="/1" className="rounded-xl border border-slate-500 px-4 py-2">/1</Link>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
