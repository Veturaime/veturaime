import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  getDashboardData,
  hasCompletedOnboarding,
  signOutCurrentUser,
  supabase,
  type DashboardData
} from "../lib/supabase";

const currencyFormatter = new Intl.NumberFormat("sq-AL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat("sq-AL", {
  dateStyle: "medium"
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value ?? 0));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Pa date";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

function getCarLabel(car: DashboardData["cars"][number]) {
  const baseName = [car.make, car.model].filter(Boolean).join(" ");
  const parts = [car.nickname, baseName, car.license_plate].filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : "Vetura pa emer";
}

function getCarSummary(carId: string, cars: DashboardData["cars"]) {
  const car = cars.find((item) => item.id === carId);

  if (!car) {
    return "Vetura e panjohur";
  }

  return getCarLabel(car);
}

function getDocumentStatus(expiresOn: string | null) {
  if (!expiresOn) {
    return {
      label: "Pa afat",
      className: "border-slate-600/70 bg-slate-800/70 text-slate-300"
    };
  }

  const expiresAt = new Date(expiresOn);
  const today = new Date();
  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return {
      label: "Skaduar",
      className: "border-red-500/40 bg-red-500/10 text-red-200"
    };
  }

  if (daysUntilExpiry <= 30) {
    return {
      label: "Se shpejti",
      className: "border-amber-400/40 bg-amber-400/10 text-amber-100"
    };
  }

  return {
    label: "Aktiv",
    className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
  };
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-600/80 bg-slate-900/35 px-4 py-5 text-sm text-slate-300">
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="mt-1 leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const guardAndLoadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const { data, error: userError } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

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

        if (!completed) {
          navigate("/onboarding", { replace: true });
          return;
        }

        const payload = await getDashboardData();

        if (!isMounted) {
          return;
        }

        setDashboard(payload);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Dashboard failed to load.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void guardAndLoadDashboard();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const quickStartContext = useMemo(() => {
    const params = new URLSearchParams(location.search);

    return {
      flow: params.get("flow") ?? "",
      query: params.get("q")?.trim() ?? ""
    };
  }, [location.search]);

  const totalExpenseAmount = useMemo(() => {
    return (dashboard?.expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  }, [dashboard]);

  const activeDocumentsCount = useMemo(() => {
    return (dashboard?.documents ?? []).filter((document) => document.status !== "archived").length;
  }, [dashboard]);

  const onboardingPreferences = useMemo(() => {
    if (!dashboard?.profile) {
      return [];
    }

    return [
      {
        label: "Transmisioni",
        value: dashboard.profile.transmission_preference
      },
      {
        label: "Karoseria",
        value: dashboard.profile.car_body_preference
      },
      {
        label: "Stili",
        value: dashboard.profile.car_style_preference
      },
      {
        label: "Konsumi",
        value: dashboard.profile.fuel_consumption_priority
      },
      {
        label: "E ardhmja EV",
        value: dashboard.profile.electric_future_preference
      }
    ].filter((item) => Boolean(item.value));
  }, [dashboard]);

  const upcomingDocuments = useMemo(() => {
    return [...(dashboard?.documents ?? [])]
      .sort((left, right) => {
        if (!left.expires_on && !right.expires_on) {
          return 0;
        }

        if (!left.expires_on) {
          return 1;
        }

        if (!right.expires_on) {
          return -1;
        }

        return new Date(left.expires_on).getTime() - new Date(right.expires_on).getTime();
      })
      .slice(0, 4);
  }, [dashboard]);

  const onReload = async () => {
    setLoading(true);
    setError("");

    try {
      const payload = await getDashboardData();
      setDashboard(payload);
    } catch (reloadError) {
      setError(reloadError instanceof Error ? reloadError.message : "Dashboard failed to refresh.");
    } finally {
      setLoading(false);
    }
  };

  const onSignOut = async () => {
    setIsSigningOut(true);
    setError("");

    try {
      await signOutCurrentUser();
      navigate("/login", { replace: true });
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Sign out failed.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#163047,#08111a_55%)] px-4 py-6 text-slate-100 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-mint/80">VeturaIme Dashboard</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">
                {dashboard?.profile?.full_name ? `Mire se erdhe, ${dashboard.profile.full_name}` : "Paneli i vetures"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Ky panel lexon te dhenat reale nga Supabase per veturat, servisimet, dokumentet dhe shpenzimet e
                perdoruesit aktiv.
              </p>
              {quickStartContext.query ? (
                <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs font-semibold text-mint">
                  <span>Quick start</span>
                  <span className="text-white/80">{quickStartContext.flow || "dashboard"}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-white">{quickStartContext.query}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onReload}
                disabled={loading}
                className="ui-interactive rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Duke rifreskuar..." : "Rifresko"}
              </button>
              <Link
                to="/"
                className="ui-interactive rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ballina
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                disabled={isSigningOut}
                className="ui-interactive rounded-xl bg-mint px-4 py-2 text-sm font-bold text-deep transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningOut ? "Po dal..." : "Dil"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
              {error}
            </div>
          ) : null}

          {loading && !dashboard ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-slate-300">
              Duke ngarkuar dashboard-in...
            </div>
          ) : null}

          {dashboard ? (
            <>
              <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-400">Veturat</p>
                  <p className="mt-3 text-3xl font-extrabold text-white">{dashboard.cars.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Numri total i veturave te lidhura me profilin.</p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-400">Servisime</p>
                  <p className="mt-3 text-3xl font-extrabold text-white">{dashboard.serviceRecords.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Servisimet e fundit te lexuara nga tabela service_records.</p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-400">Dokumente aktive</p>
                  <p className="mt-3 text-3xl font-extrabold text-white">{activeDocumentsCount}</p>
                  <p className="mt-2 text-sm text-slate-400">Dokumentet qe nuk jane te arkivuara.</p>
                </article>

                <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-400">Shpenzime</p>
                  <p className="mt-3 text-3xl font-extrabold text-white">{formatCurrency(totalExpenseAmount)}</p>
                  <p className="mt-2 text-sm text-slate-400">Shuma e rreshtave te ngarkuar nga tabela expenses.</p>
                </article>
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
                <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Fleet</p>
                      <h2 className="mt-2 text-2xl font-bold text-white">Veturat e ruajtura</h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      live
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {dashboard.cars.length > 0 ? (
                      dashboard.cars.map((car) => (
                        <article
                          key={car.id}
                          className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-mint/35"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-white">{getCarLabel(car)}</p>
                              <p className="mt-1 text-sm text-slate-400">
                                {car.year ? `${car.year} • ` : ""}
                                {car.color || "Ngjyra pa specifikim"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right text-xs text-slate-300">
                              <div>Mileage</div>
                              <div className="mt-1 font-semibold text-white">
                                {car.mileage ? `${car.mileage.toLocaleString("sq-AL")} km` : "Pa mileage"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                            {car.vin ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">VIN: {car.vin}</span>
                            ) : null}
                            {car.license_plate ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                Targa: {car.license_plate}
                              </span>
                            ) : null}
                          </div>
                        </article>
                      ))
                    ) : (
                      <EmptyPanel
                        title="Nuk ka vetura ende"
                        description="Shto rreshtin e pare ne tabelen public.cars dhe dashboard-i do ta shfaqe automatikisht."
                      />
                    )}
                  </div>
                </article>

                <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Profili</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Preferencat nga onboarding</h2>

                  {onboardingPreferences.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {onboardingPreferences.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3"
                        >
                          <span className="text-sm text-slate-400">{item.label}</span>
                          <span className="text-sm font-semibold text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel
                      title="Pa preferenca shtese"
                      description="Ky perdorues e ka kaluar onboarding-un pa ruajtur pergjigje te personalizuara."
                    />
                  )}

                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">Statusi i profilit</p>
                    <p className="mt-2 leading-6">
                      Onboarding: {dashboard.profile?.onboarding_completed_at ? "i perfunduar" : "ne pritje"}
                    </p>
                    <p className="mt-1 leading-6">Krijuar: {formatDate(dashboard.profile?.created_at ?? null)}</p>
                  </div>
                </article>
              </section>

              <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Service log</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Servisimet e fundit</h2>

                  <div className="mt-5 space-y-3">
                    {dashboard.serviceRecords.length > 0 ? (
                      dashboard.serviceRecords.map((record) => (
                        <article
                          key={record.id}
                          className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 text-sm text-slate-300"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{record.service_type}</p>
                              <p className="mt-1 text-slate-400">{getCarSummary(record.car_id, dashboard.cars)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-mint">{formatCurrency(record.cost)}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatDate(record.service_date)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {record.provider ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                Servisi: {record.provider}
                              </span>
                            ) : null}
                            {record.mileage ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                {record.mileage.toLocaleString("sq-AL")} km
                              </span>
                            ) : null}
                            {record.next_service_due_at ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                Tjetra: {formatDate(record.next_service_due_at)}
                              </span>
                            ) : null}
                          </div>
                          {record.notes ? <p className="mt-3 text-sm leading-6 text-slate-400">{record.notes}</p> : null}
                        </article>
                      ))
                    ) : (
                      <EmptyPanel
                        title="Nuk ka servisime"
                        description="Shto te dhena ne public.service_records per te pare historikun e mirembajtjes."
                      />
                    )}
                  </div>
                </article>

                <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Documents</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Afatet qe po afrohen</h2>

                  <div className="mt-5 space-y-3">
                    {upcomingDocuments.length > 0 ? (
                      upcomingDocuments.map((document) => {
                        const status = getDocumentStatus(document.expires_on);

                        return (
                          <article
                            key={document.id}
                            className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 text-sm text-slate-300"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{document.document_type}</p>
                                <p className="mt-1 text-slate-400">{getCarSummary(document.car_id, dashboard.cars)}</p>
                              </div>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                                {status.label}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {document.reference_number ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                  Ref: {document.reference_number}
                                </span>
                              ) : null}
                              {document.issuer ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                  Leshuar nga: {document.issuer}
                                </span>
                              ) : null}
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                Skadon: {formatDate(document.expires_on)}
                              </span>
                            </div>

                            {document.notes ? <p className="mt-3 leading-6 text-slate-400">{document.notes}</p> : null}
                          </article>
                        );
                      })
                    ) : (
                      <EmptyPanel
                        title="Nuk ka dokumente"
                        description="Shto rreshta ne public.documents per te ndjekur regjistrimin, sigurimin dhe afate te tjera."
                      />
                    )}
                  </div>
                </article>
              </section>

              <section className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Expenses</p>
                    <h2 className="mt-2 text-2xl font-bold text-white">Shpenzimet e fundit</h2>
                  </div>
                  <Link
                    to="/1"
                    className="ui-interactive rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Shiko /1
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {dashboard.expenses.length > 0 ? (
                    dashboard.expenses.map((expense) => (
                      <article
                        key={expense.id}
                        className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 text-sm text-slate-300"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{expense.category}</p>
                            <p className="mt-1 text-slate-400">{getCarSummary(expense.car_id, dashboard.cars)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-mint">{formatCurrency(expense.amount)}</p>
                            <p className="mt-1 text-xs text-slate-400">{formatDate(expense.expense_date)}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {expense.vendor ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                              Furnizuesi: {expense.vendor}
                            </span>
                          ) : null}
                        </div>

                        {expense.notes ? <p className="mt-3 leading-6 text-slate-400">{expense.notes}</p> : null}
                      </article>
                    ))
                  ) : (
                    <EmptyPanel
                      title="Nuk ka shpenzime"
                      description="Shto rreshta ne public.expenses per te pare raportim real ne kete seksion."
                    />
                  )}
                </div>
              </section>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default DashboardPage;
