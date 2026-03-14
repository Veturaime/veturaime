import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getVehicleDashboardData, supabase, type VehicleDashboardData } from "../lib/supabase";

const dateFormatter = new Intl.DateTimeFormat("sq-AL", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function formatDate(value: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return dateFormatter.format(parsed);
}

function getDateTimestamp(dateValue: string | null | undefined, fallback = 0) {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? fallback : timestamp;
}

function isOilChangeServiceType(serviceType: string) {
  return serviceType.trim().toLowerCase() === "ndërrim vaji + filtra";
}

function VehicleMileagePage() {
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
          setError(loadError instanceof Error ? loadError.message : "Ngarkimi i kilometrave dështoi.");
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

  const mileageData = useMemo(() => {
    if (!data) {
      return {
        registrationMileage: null as number | null,
        currentMileage: null as number | null,
        mileageDifference: null as number | null,
        latestServiceWithMileage: null as (typeof data extends VehicleDashboardData ? never : never),
        timelineRows: [] as Array<{ id: string; date: string | null; label: string; mileage: number }>
      };
    }

    const activeServiceRecords = data.serviceRecords.filter((service) => !service.deleted_at);
    const mileageServiceRows = activeServiceRecords
      .filter((service) => isOilChangeServiceType(service.service_type) && typeof service.mileage === "number")
      .sort((left, right) => {
        const byServiceDate = getDateTimestamp(right.service_date) - getDateTimestamp(left.service_date);
        if (byServiceDate !== 0) return byServiceDate;
        return getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at);
      });

    const latestServiceWithMileage = mileageServiceRows[0] ?? null;
    const registrationMileage = typeof data.car.mileage === "number" ? data.car.mileage : null;
    const currentMileage = latestServiceWithMileage?.mileage ?? registrationMileage;
    const mileageDifference =
      typeof registrationMileage === "number" && typeof currentMileage === "number"
        ? currentMileage - registrationMileage
        : null;

    const timelineRows = [
      ...(typeof registrationMileage === "number"
        ? [
            {
              id: "registration",
              date: data.car.created_at,
              label: "Regjistrimi i veturës",
              mileage: registrationMileage
            }
          ]
        : []),
      ...mileageServiceRows.map((service) => ({
        id: service.id,
        date: service.service_date,
        label: service.service_type,
        mileage: service.mileage as number
      }))
    ].sort((left, right) => getDateTimestamp(left.date) - getDateTimestamp(right.date));

    return {
      registrationMileage,
      currentMileage,
      mileageDifference,
      latestServiceWithMileage,
      timelineRows
    };
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
        <div className="dashboard-panel w-full max-w-xl rounded-3xl p-5 text-center sm:p-8">
          <p className="text-lg text-[#b42318]">{error || "Kilometrazhi nuk u gjet."}</p>
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
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#4d675f]">Kilometrazhi i Veturës</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-[#111827] sm:text-3xl">
              {data.car.make} {data.car.model}
            </h1>
            <p className="mt-2 text-[#6B7280]">Këtu shfaqet i gjithë historiku i kilometrave për këtë veturë.</p>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full rounded-xl bg-[#2D3A3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#253030] sm:w-auto"
          >
            Kthehu mbrapa
          </button>
        </div>

        <section className="dashboard-panel rounded-3xl p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-2xl bg-[#f8fafc] p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
              <p className="text-xs uppercase tracking-[0.12em] text-[#9ca3af]">KM në regjistrim</p>
              <p className="mt-2 text-2xl font-bold text-[#1F2937]">
                {typeof mileageData.registrationMileage === "number"
                  ? `${mileageData.registrationMileage.toLocaleString("sq-AL")} km`
                  : "—"}
              </p>
            </article>

            <article className="rounded-2xl bg-[#f8fafc] p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
              <p className="text-xs uppercase tracking-[0.12em] text-[#9ca3af]">KM aktuale</p>
              <p className="mt-2 text-2xl font-bold text-[#1F2937]">
                {typeof mileageData.currentMileage === "number"
                  ? `${mileageData.currentMileage.toLocaleString("sq-AL")} km`
                  : "—"}
              </p>
            </article>

            <article className="rounded-2xl bg-[#f8fafc] p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
              <p className="text-xs uppercase tracking-[0.12em] text-[#9ca3af]">Ndryshimi</p>
              <p className="mt-2 text-2xl font-bold text-[#2D3A3A]">
                {typeof mileageData.mileageDifference === "number"
                  ? `${mileageData.mileageDifference >= 0 ? "+" : ""}${mileageData.mileageDifference.toLocaleString("sq-AL")} km`
                  : "—"}
              </p>
            </article>
          </div>

          <div className="mt-6 rounded-2xl bg-[linear-gradient(145deg,#f6fbf9,#eef6f4)] p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-[#1F2937]">Historia e kilometrave</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Ruhet automatikisht nga regjistrimi dhe servisimet me kilometrazh.</p>
              </div>

              <div className="rounded-full bg-[#e7f1ee] px-3 py-1 text-xs font-semibold text-[#2D3A3A]">
                {mileageData.timelineRows.length} hyrje
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {mileageData.timelineRows.length > 0 ? (
                mileageData.timelineRows.map((row) => (
                  <article
                    key={`mileage-page-${row.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#1F2937]">{row.label}</p>
                      <p className="mt-1 text-xs text-[#6B7280]">{formatDate(row.date)}</p>
                    </div>

                    <span className="rounded-lg bg-[#f5f7fa] px-3 py-1 text-sm font-semibold text-[#2D3A3A]">
                      {row.mileage.toLocaleString("sq-AL")} km
                    </span>
                  </article>
                ))
              ) : (
                <div className="dashboard-empty-state rounded-2xl p-6 text-sm">Nuk ka hyrje të kilometrave ende.</div>
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-white p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
              <p className="text-xs uppercase tracking-[0.12em] text-[#9ca3af]">Përditësimi i fundit</p>
              <p className="mt-2 text-sm font-semibold text-[#1F2937]">
                {mileageData.latestServiceWithMileage
                  ? formatDate(mileageData.latestServiceWithMileage.service_date)
                  : "Nga regjistrimi fillestar"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default VehicleMileagePage;