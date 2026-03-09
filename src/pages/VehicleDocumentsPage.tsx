import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DocumentRow } from "../lib/database.types";
import { getVehicleDashboardData, supabase, type VehicleDashboardData } from "../lib/supabase";

const dateFormatter = new Intl.DateTimeFormat("sq-AL", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

const DOCUMENT_TYPES: Record<string, string> = {
  registration: "Regjistrimi",
  insurance: "Sigurimi",
  inspection: "Kontrolli Teknik",
  authorization: "Leja/Autorizim",
  invoice: "Faturë / Kupon",
  manual: "Manual / të tjera",
  license: "Leja/Autorizim",
  tax: "Faturë / Kupon",
  warranty: "Manual / të tjera",
  other: "Tjetër"
};

function formatDate(value: string | null) {
  if (!value) return "Pa afat";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return dateFormatter.format(parsed);
}

function getDaysUntil(dateValue: string | null) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusMeta(document: DocumentRow) {
  const days = getDaysUntil(document.expires_on);

  if (days === null) {
    return { label: "Pa afat", className: "bg-[#eef2f6] text-[#6B7280]" };
  }

  if (days < 0) {
    return { label: "Skaduar", className: "bg-[#fee4e2] text-[#b42318]" };
  }

  if (days <= 30) {
    return { label: `${days} ditë`, className: "bg-[#fef3c7] text-[#b45309]" };
  }

  return { label: "Aktiv", className: "bg-[#dcfce7] text-[#166534]" };
}

function VehicleDocumentsPage() {
  const { carId } = useParams<{ carId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<VehicleDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Ngarkimi i dokumenteve dështoi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [carId, navigate]);

  const sortedDocuments = useMemo(() => {
    if (!data) return [];

    return [...data.documents].sort((left, right) => {
      const leftTime = left.expires_on ? new Date(left.expires_on).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.expires_on ? new Date(right.expires_on).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  }, [data]);

  if (loading) {
    return (
      <main className="vehicle-dashboard-soft flex min-h-screen items-center justify-center bg-[#F9FAFB] text-[#1F2937]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#2D3A3A] border-t-transparent" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="vehicle-dashboard-soft flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4 text-[#1F2937]">
        <div className="dashboard-panel w-full max-w-xl rounded-3xl p-8 text-center">
          <p className="text-lg text-[#b42318]">{error || "Dokumentet nuk u gjetën."}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 rounded-xl bg-[#2D3A3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#253030]"
          >
            Kthehu mbrapa
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="vehicle-dashboard-soft min-h-screen bg-[#F9FAFB] px-4 py-8 text-[#1F2937] antialiased md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4d675f]">Dokumentet e Veturës</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-[#111827]">
              {data.car.make} {data.car.model}
            </h1>
            <p className="mt-2 text-[#6B7280]">Këtu i shihni vetëm dokumentet e regjistruara për këtë veturë.</p>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl bg-[#2D3A3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#253030]"
          >
            Kthehu mbrapa
          </button>
        </div>

        <section className="dashboard-panel rounded-3xl p-6">
          {sortedDocuments.length === 0 ? (
            <div className="dashboard-empty-state rounded-2xl p-6 text-sm">Nuk ka dokumente ende.</div>
          ) : (
            <div className="space-y-4">
              {sortedDocuments.map((document) => {
                const status = getStatusMeta(document);
                const documentLabel = DOCUMENT_TYPES[document.document_type] ?? DOCUMENT_TYPES.other;

                return (
                  <article key={document.id} className="rounded-2xl bg-[#f8fafc] p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#6B7280]">{documentLabel}</p>
                        <h2 className="mt-2 font-display text-xl font-bold text-[#1F2937]">
                          {document.reference_number || documentLabel}
                        </h2>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-[#9ca3af]">Skadon</p>
                        <p className="mt-1 text-sm font-semibold text-[#1F2937]">{formatDate(document.expires_on)}</p>
                      </div>
                      {document.issuer && (
                        <div>
                          <p className="text-xs uppercase tracking-[0.12em] text-[#9ca3af]">Lëshuar nga</p>
                          <p className="mt-1 text-sm font-semibold text-[#1F2937]">{document.issuer}</p>
                        </div>
                      )}
                      {document.file_url && (
                        <div>
                          <p className="text-xs uppercase tracking-[0.12em] text-[#9ca3af]">Skedari</p>
                          <a
                            href={document.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex text-sm font-semibold text-[#2D3A3A] hover:underline"
                          >
                            Hap dokumentin
                          </a>
                        </div>
                      )}
                    </div>

                    {document.notes && <p className="mt-4 whitespace-pre-line text-sm text-[#6B7280]">{document.notes}</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default VehicleDocumentsPage;