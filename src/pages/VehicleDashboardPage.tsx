import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { DocumentRow, ExpenseRow, ServiceRecordRow } from "../lib/database.types";
import { getVehicleDashboardData, supabase, type VehicleDashboardData, updateCar } from "../lib/supabase";
import {
  BODY_TYPES,
  COLORS,
  fetchVehicleImage,
  FUEL_TYPES,
  getRenderableVehicleImageUrl,
  isGeneratedVehiclePlaceholder,
  TRANSMISSION_TYPES
} from "../lib/vehicle-data";

// Formatters
const currencyFormatter = new Intl.NumberFormat("sq-AL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat("sq-AL", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return dateFormatter.format(d);
}

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDocumentStatus(expiresOn: string | null) {
  const days = getDaysUntil(expiresOn);

  if (days === null) {
    return { status: "unknown", label: "Pa afat", color: "slate", icon: "?" };
  }
  if (days < 0) {
    return { status: "expired", label: "Skaduar", color: "red", icon: "!" };
  }
  if (days <= 14) {
    return { status: "urgent", label: `${days} ditë`, color: "red", icon: "!" };
  }
  if (days <= 30) {
    return { status: "warning", label: `${days} ditë`, color: "amber", icon: "⚠" };
  }
  if (days <= 60) {
    return { status: "soon", label: `${days} ditë`, color: "yellow", icon: "○" };
  }
  return { status: "ok", label: `${days} ditë`, color: "emerald", icon: "✓" };
}

// Document type icons and labels
const DOCUMENT_TYPES: Record<string, { label: string; icon: string }> = {
  registration: { label: "Regjistrimi", icon: "📋" },
  insurance: { label: "Sigurimi", icon: "🛡️" },
  inspection: { label: "Kontrolli Teknik", icon: "🔧" },
  license: { label: "Patenta", icon: "🪪" },
  tax: { label: "Taksa Rrugore", icon: "💰" },
  warranty: { label: "Garancia", icon: "📜" },
  other: { label: "Tjetër", icon: "📄" }
};

type Tab = "overview" | "documents" | "services" | "expenses";

function VehicleDashboardPage() {
  const { carId } = useParams<{ carId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<VehicleDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [carImage, setCarImage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!carId) {
        navigate("/my-garage", { replace: true });
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (!userData.user) {
          navigate("/login", { replace: true });
          return;
        }

        const dashboardData = await getVehicleDashboardData(carId);
        if (!isMounted) return;

        setData(dashboardData);

        // Fetch car image
        const car = dashboardData.car;
        if (car.image_url && !isGeneratedVehiclePlaceholder(car.image_url)) {
          setCarImage(car.image_url);
        } else {
          const url = await fetchVehicleImage(
            car.make,
            car.model,
            car.year ?? undefined,
            car.body_type ?? undefined,
            car.color ?? undefined
          );

          if (url && !isGeneratedVehiclePlaceholder(url) && url !== car.image_url) {
            void updateCar(car.id, { image_url: url }).catch(() => undefined);
          }

          if (isMounted) {
            setCarImage(url);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Ngarkimi i të dhënave dështoi.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [carId, navigate]);

  // Computed values
  const urgentDocuments = useMemo(() => {
    if (!data) return [];
    return data.documents
      .filter((d) => {
        const days = getDaysUntil(d.expires_on);
        return days !== null && days <= 30;
      })
      .sort((a, b) => {
        const daysA = getDaysUntil(a.expires_on) ?? Infinity;
        const daysB = getDaysUntil(b.expires_on) ?? Infinity;
        return daysA - daysB;
      });
  }, [data]);

  const totalExpenses = useMemo(() => {
    if (!data) return 0;
    return data.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [data]);

  const totalServices = useMemo(() => {
    if (!data) return 0;
    return data.serviceRecords.reduce((sum, s) => sum + Number(s.cost), 0);
  }, [data]);

  const nextService = useMemo(() => {
    if (!data) return null;
    return data.serviceRecords.find((s) => s.next_service_due_at);
  }, [data]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-deep text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-mint border-t-transparent" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-deep px-4 text-white">
        <div className="text-center">
          <p className="text-lg text-red-400">{error || "Vetura nuk u gjet."}</p>
          <Link
            to="/my-garage"
            className="mt-4 inline-flex items-center gap-2 text-mint hover:underline"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kthehu te garazhi
          </Link>
        </div>
      </main>
    );
  }

  const { car, documents, serviceRecords, expenses } = data;
  const colorInfo = COLORS.find((c) => c.value === car.color);
  const bodyTypeInfo = BODY_TYPES.find((b) => b.value === car.body_type);
  const fuelTypeInfo = FUEL_TYPES.find((f) => f.value === car.fuel_type);
  const transmissionInfo = TRANSMISSION_TYPES.find((t) => t.value === car.transmission);
  const renderableCarImage = getRenderableVehicleImageUrl(carImage);

  return (
    <main className="relative min-h-screen bg-deep font-body text-white antialiased">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(72,242,194,0.03),transparent_50%)]" />

      {/* Header with car hero */}
      <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-deep">
        {/* Background image */}
        {carImage && (
          <div className="absolute inset-0 opacity-20">
            <img src={renderableCarImage ?? carImage} alt="" className="h-full w-full object-cover blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-deep/50 via-deep/80 to-deep" />
          </div>
        )}

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-8">
          {/* Breadcrumb */}
          <Link
            to="/my-garage"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Garazhi im
          </Link>

          {/* Car title */}
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-5">
              {/* Car thumbnail */}
              <div className="hidden h-24 w-36 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 sm:block">
                {carImage ? (
                  <img
                    src={renderableCarImage ?? carImage}
                    alt={`${car.make} ${car.model}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                    {car.make} {car.model}
                  </h1>
                  {colorInfo && (
                    <div
                      className="h-4 w-4 rounded-full border border-white/30"
                      style={{ backgroundColor: colorInfo.hex }}
                      title={colorInfo.label}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  {car.year && <span>{car.year}</span>}
                  {bodyTypeInfo && (
                    <>
                      <span className="text-white/20">•</span>
                      <span>{bodyTypeInfo.label}</span>
                    </>
                  )}
                  {fuelTypeInfo && (
                    <>
                      <span className="text-white/20">•</span>
                      <span>{fuelTypeInfo.label}</span>
                    </>
                  )}
                  {transmissionInfo && (
                    <>
                      <span className="text-white/20">•</span>
                      <span>{transmissionInfo.label}</span>
                    </>
                  )}
                </div>
                {car.license_plate && (
                  <div className="mt-2 inline-flex rounded-lg border border-white/15 bg-white/5 px-3 py-1 font-mono text-sm">
                    {car.license_plate}
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex gap-4">
              {car.mileage && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-white">{car.mileage.toLocaleString("sq-AL")}</p>
                  <p className="text-xs text-slate-400">km</p>
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-mint">{documents.length}</p>
                <p className="text-xs text-slate-400">dokumente</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="mt-8 flex gap-1 overflow-x-auto">
            {[
              { key: "overview" as Tab, label: "Përmbledhje", icon: "📊" },
              { key: "documents" as Tab, label: "Dokumente", icon: "📋" },
              { key: "services" as Tab, label: "Servisime", icon: "🔧" },
              { key: "expenses" as Tab, label: "Shpenzime", icon: "💰" }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "bg-mint/10 text-mint"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Urgent alerts */}
            {urgentDocuments.length > 0 && (
              <section className="rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-900/5 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-xl">
                    ⚠️
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-red-300">Vëmendje!</h2>
                    <p className="text-sm text-red-300/70">
                      {urgentDocuments.length} dokument{urgentDocuments.length > 1 ? "e" : ""} po skadon së shpejti
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {urgentDocuments.slice(0, 4).map((doc) => {
                    const status = getDocumentStatus(doc.expires_on);
                    const docType = DOCUMENT_TYPES[doc.document_type] || DOCUMENT_TYPES.other;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-deep/50 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{docType.icon}</span>
                          <div>
                            <p className="font-semibold">{docType.label}</p>
                            <p className="text-xs text-slate-400">Skadon: {formatDate(doc.expires_on)}</p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            status.color === "red"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Stats grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon="📋"
                label="Dokumente"
                value={String(documents.length)}
                sublabel={`${urgentDocuments.length} po skadon`}
                color={urgentDocuments.length > 0 ? "amber" : "mint"}
              />
              <StatCard
                icon="🔧"
                label="Servisime"
                value={String(serviceRecords.length)}
                sublabel={formatCurrency(totalServices)}
                color="blue"
              />
              <StatCard
                icon="💰"
                label="Shpenzime"
                value={formatCurrency(totalExpenses)}
                sublabel={`${expenses.length} transaksione`}
                color="purple"
              />
              <StatCard
                icon="📅"
                label="Servisi Tjetër"
                value={nextService?.next_service_due_at ? formatDate(nextService.next_service_due_at) : "—"}
                sublabel={nextService?.service_type || "Pa planifikim"}
                color="slate"
              />
            </div>

            {/* Recent activity */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent documents */}
              <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">Dokumentet</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("documents")}
                    className="text-sm text-mint hover:underline"
                  >
                    Shiko të gjitha
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {documents.slice(0, 4).map((doc) => (
                    <DocumentRow key={doc.id} document={doc} />
                  ))}
                  {documents.length === 0 && (
                    <EmptyState message="Asnjë dokument i regjistruar" icon="📋" />
                  )}
                </div>
              </section>

              {/* Recent services */}
              <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">Servisimet e Fundit</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("services")}
                    className="text-sm text-mint hover:underline"
                  >
                    Shiko të gjitha
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {serviceRecords.slice(0, 4).map((service) => (
                    <ServiceRow key={service.id} service={service} />
                  ))}
                  {serviceRecords.length === 0 && (
                    <EmptyState message="Asnjë servisim i regjistruar" icon="🔧" />
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Documents tab */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Dokumentet e Veturës</h2>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2.5 text-sm font-bold text-deep transition hover:bg-mint/90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Shto Dokument
              </button>
            </div>

            {documents.length === 0 ? (
              <EmptyState
                message="Filloni duke shtuar dokumentet e rëndësishme të veturës suaj"
                icon="📋"
                action="Shto Dokumentin e Parë"
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Services tab */}
        {activeTab === "services" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Historia e Servisimeve</h2>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2.5 text-sm font-bold text-deep transition hover:bg-mint/90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Shto Servisim
              </button>
            </div>

            {serviceRecords.length === 0 ? (
              <EmptyState
                message="Regjistroni mirëmbajtjen dhe servisimet e veturës"
                icon="🔧"
                action="Shto Servisimin e Parë"
              />
            ) : (
              <div className="space-y-4">
                {serviceRecords.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expenses tab */}
        {activeTab === "expenses" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">Shpenzimet</h2>
                <p className="text-sm text-slate-400">
                  Totali: <span className="font-semibold text-mint">{formatCurrency(totalExpenses)}</span>
                </p>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2.5 text-sm font-bold text-deep transition hover:bg-mint/90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Shto Shpenzim
              </button>
            </div>

            {expenses.length === 0 ? (
              <EmptyState
                message="Mbani gjurmët e shpenzimeve të veturës"
                icon="💰"
                action="Shto Shpenzimin e Parë"
              />
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Sub-components

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color
}: {
  icon: string;
  label: string;
  value: string;
  sublabel: string;
  color: "mint" | "blue" | "purple" | "amber" | "slate";
}) {
  const colorClasses = {
    mint: "from-mint/10 to-emerald-500/5 border-mint/20",
    blue: "from-blue-500/10 to-blue-900/5 border-blue-500/20",
    purple: "from-purple-500/10 to-purple-900/5 border-purple-500/20",
    amber: "from-amber-500/10 to-amber-900/5 border-amber-500/20",
    slate: "from-slate-500/10 to-slate-900/5 border-slate-500/20"
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
    </div>
  );
}

function DocumentRow({ document }: { document: DocumentRow }) {
  const status = getDocumentStatus(document.expires_on);
  const docType = DOCUMENT_TYPES[document.document_type] || DOCUMENT_TYPES.other;

  const statusColors = {
    red: "text-red-400",
    amber: "text-amber-400",
    yellow: "text-yellow-400",
    emerald: "text-emerald-400",
    slate: "text-slate-400"
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-deep/30 p-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{docType.icon}</span>
        <div>
          <p className="font-medium">{docType.label}</p>
          <p className="text-xs text-slate-400">{formatDate(document.expires_on)}</p>
        </div>
      </div>
      <span className={`text-sm font-semibold ${statusColors[status.color as keyof typeof statusColors]}`}>
        {status.label}
      </span>
    </div>
  );
}

function DocumentCard({ document }: { document: DocumentRow }) {
  const status = getDocumentStatus(document.expires_on);
  const docType = DOCUMENT_TYPES[document.document_type] || DOCUMENT_TYPES.other;

  const bgColors = {
    red: "from-red-500/10 to-red-900/5 border-red-500/20",
    amber: "from-amber-500/10 to-amber-900/5 border-amber-500/20",
    yellow: "from-yellow-500/10 to-yellow-900/5 border-yellow-500/20",
    emerald: "from-emerald-500/10 to-emerald-900/5 border-emerald-500/20",
    slate: "from-slate-500/10 to-slate-900/5 border-slate-500/20"
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${bgColors[status.color as keyof typeof bgColors]}`}>
      <div className="flex items-start justify-between">
        <span className="text-3xl">{docType.icon}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            status.color === "red"
              ? "bg-red-500/20 text-red-300"
              : status.color === "amber"
                ? "bg-amber-500/20 text-amber-300"
                : status.color === "emerald"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-500/20 text-slate-300"
          }`}
        >
          {status.label}
        </span>
      </div>
      <h4 className="mt-4 font-display text-lg font-bold">{docType.label}</h4>
      <div className="mt-3 space-y-1 text-sm text-slate-400">
        <p>Skadon: {formatDate(document.expires_on)}</p>
        {document.issuer && <p>Lëshuar nga: {document.issuer}</p>}
        {document.reference_number && <p>Ref: {document.reference_number}</p>}
      </div>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceRecordRow }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-deep/30 p-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">🔧</span>
        <div>
          <p className="font-medium">{service.service_type}</p>
          <p className="text-xs text-slate-400">{formatDate(service.service_date)}</p>
        </div>
      </div>
      <span className="font-semibold text-mint">{formatCurrency(service.cost)}</span>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceRecordRow }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-display text-lg font-bold">{service.service_type}</h4>
          <p className="text-sm text-slate-400">{formatDate(service.service_date)}</p>
        </div>
        <span className="text-xl font-bold text-mint">{formatCurrency(service.cost)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {service.provider && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            📍 {service.provider}
          </span>
        )}
        {service.mileage && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            🛣️ {service.mileage.toLocaleString("sq-AL")} km
          </span>
        )}
        {service.next_service_due_at && (
          <span className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 text-mint">
            📅 Tjetra: {formatDate(service.next_service_due_at)}
          </span>
        )}
      </div>
      {service.notes && <p className="mt-3 text-sm text-slate-400">{service.notes}</p>}
    </div>
  );
}

function ExpenseCard({ expense }: { expense: ExpenseRow }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <div className="flex items-center gap-4">
        <span className="text-2xl">💰</span>
        <div>
          <p className="font-semibold">{expense.category}</p>
          <p className="text-xs text-slate-400">
            {formatDate(expense.expense_date)}
            {expense.vendor && ` • ${expense.vendor}`}
          </p>
        </div>
      </div>
      <span className="text-lg font-bold text-mint">{formatCurrency(expense.amount)}</span>
    </div>
  );
}

function EmptyState({
  message,
  icon,
  action
}: {
  message: string;
  icon: string;
  action?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 py-12 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="mt-4 text-slate-400">{message}</p>
      {action && (
        <button
          type="button"
          className="mt-4 rounded-xl bg-mint/10 px-4 py-2 text-sm font-semibold text-mint transition hover:bg-mint/20"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export default VehicleDashboardPage;
