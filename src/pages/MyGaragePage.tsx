import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import brandLogo from "../../assets/foto.png";
import fallbackVehicleImage from "../../assets/Mercedes-E-Class-620x350-1.png";
import type { CarRow } from "../lib/database.types";
import { getUserCars, signOutCurrentUser, supabase, updateCar } from "../lib/supabase";
import {
  BODY_TYPES,
  COLORS,
  fetchVehicleImage,
  FUEL_TYPES,
  getRenderableVehicleImageUrl,
  isGeneratedVehiclePlaceholder
} from "../lib/vehicle-data";

function MyGaragePage() {
  const navigate = useNavigate();
  const [cars, setCars] = useState<CarRow[]>([]);
  const [carImages, setCarImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadGarage = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: userData } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (!userData.user) {
          navigate("/login", { replace: true });
          return;
        }

        // Get user profile name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userData.user.id)
          .single();

        if (isMounted && profile) {
          setUserName(profile.full_name);
        }

        const userCars = await getUserCars();

        if (!isMounted) return;

        if (userCars.length === 0) {
          navigate("/car-setup", { replace: true });
          return;
        }

        setCars(userCars);

        // Fetch images for each car
        const imagePromises = userCars.map(async (car) => {
          if (car.image_url && !isGeneratedVehiclePlaceholder(car.image_url)) {
            return { id: car.id, url: car.image_url };
          }

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

          return { id: car.id, url };
        });

        const images = await Promise.all(imagePromises);
        if (isMounted) {
          const imageMap: Record<string, string> = {};
          images.forEach((img) => {
            imageMap[img.id] = img.url;
          });
          setCarImages(imageMap);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Ngarkimi i garazhit dështoi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadGarage();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const onSignOut = async () => {
    await signOutCurrentUser();
    navigate("/", { replace: true });
  };

  const getCarDescription = (car: CarRow) => {
    const parts: string[] = [];
    if (car.year) parts.push(String(car.year));
    if (car.body_type) {
      const bt = BODY_TYPES.find((b) => b.value === car.body_type);
      if (bt) parts.push(bt.label);
    }
    if (car.fuel_type) {
      const ft = FUEL_TYPES.find((f) => f.value === car.fuel_type);
      if (ft) parts.push(ft.label);
    }
    return parts.join(" • ") || "Veturë";
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F9FAFB] font-body text-[#1F2937] antialiased">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-12 h-80 w-80 rounded-full bg-[#b8c8c5]/20 blur-3xl" />
        <div className="absolute -right-24 top-32 h-96 w-96 rounded-full bg-[#c8d8eb]/20 blur-3xl" />
        <div className="absolute bottom-[-140px] left-1/3 h-[420px] w-[420px] rounded-full bg-[#2D3A3A]/[0.04] blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-[#e6eaee] bg-[#F9FAFB]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:flex-nowrap md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl ring-1 ring-[#d2e4e1] shadow-[0px_8px_24px_rgba(0,0,0,0.06)]">
              <img src={brandLogo} alt="VeturaIme logo" className="h-full w-full bg-white object-contain p-0.5" />
            </div>
            <span className="font-display text-xl font-bold text-[#111827]">VeturaIme</span>
          </Link>

          <div className="flex w-full items-center justify-end gap-2 sm:gap-3 md:w-auto">
            <Link
              to="/car-setup"
              className="flex h-10 items-center gap-2 rounded-xl bg-[#2D3A3A] px-3 text-sm font-semibold text-white shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#253030] sm:px-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="8.5" strokeWidth={1.2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.5v7m3.5-3.5h-7" />
              </svg>
              <span className="hidden sm:inline">Shto Veturë</span>
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-[#374151] shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#f3f4f6] sm:px-4"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.7}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Dil</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {/* Welcome section */}
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#4d675f]">Garazhi im</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#1F2937] md:text-4xl">
            {userName ? `Mirë se u ktheve, ${userName.split(" ")[0]}!` : "Veturat e mia"}
          </h1>
          <p className="mt-2 text-[#6B7280]">
            Zgjidhni veturën për të parë panelin e plotë të menaxhimit
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-[#fff2f2] px-4 py-3 text-sm font-medium text-[#b42318] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#2D3A3A] border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map((car, index) => {
              const colorInfo = COLORS.find((c) => c.value === car.color);

              return (
                <Link
                  key={car.id}
                  to={`/vehicle/${car.id}`}
                  className="group relative overflow-hidden rounded-3xl bg-white shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0px_16px_38px_rgba(0,0,0,0.08)]"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {car.is_primary && (
                    <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-[#d7efe9] px-3 py-1 text-xs font-bold text-[#2D3A3A]">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M10 3.5l2 4.1 4.5.6-3.2 3.2.8 4.6-4.1-2.2-4 2.2.8-4.6L3.5 8.2l4.5-.6 2-4.1z" />
                      </svg>
                      Kryesore
                    </div>
                  )}

                  <div className="aspect-[16/10] overflow-hidden bg-[linear-gradient(140deg,#fff_5%,#f4f7fa_95%)]">
                    {carImages[car.id] ? (
                      <img
                        src={getRenderableVehicleImageUrl(carImages[car.id]) ?? carImages[car.id]}
                        alt={`${car.make} ${car.model}`}
                        className="h-full w-full object-contain p-6 drop-shadow-[0px_16px_24px_rgba(0,0,0,0.14)] transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          if (e.currentTarget.src !== fallbackVehicleImage) {
                            e.currentTarget.src = fallbackVehicleImage;
                          }
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-[#dbe3e8]" />
                      </div>
                    )}
                  </div>

                  <div className="relative p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-bold tracking-tight text-[#1F2937] transition group-hover:text-[#2D3A3A]">
                          {car.make} {car.model}
                        </h3>
                        <p className="mt-1 text-sm text-[#6B7280]">{getCarDescription(car)}</p>
                      </div>
                      {colorInfo && (
                        <div
                          className="h-5 w-5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.75),0px_3px_8px_rgba(0,0,0,0.18)]"
                          style={{ backgroundColor: colorInfo.hex }}
                          title={colorInfo.label}
                        />
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {car.license_plate && (
                        <div className="rounded-lg bg-[#f5f7fa] px-2.5 py-1.5 text-xs font-medium text-[#374151]">
                          {car.license_plate}
                        </div>
                      )}
                      {car.mileage && (
                        <div className="rounded-lg bg-[#f5f7fa] px-2.5 py-1.5 text-xs font-medium text-[#6B7280]">
                          {car.mileage.toLocaleString("sq-AL")} km
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#e7f1ee] text-[#2D3A3A] opacity-0 transition-all duration-300 group-hover:opacity-100">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}

            <Link
              to="/car-setup"
              className="group flex flex-col items-center justify-center rounded-3xl bg-white p-10 text-center shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0px_16px_38px_rgba(0,0,0,0.08)]"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e0ecea] text-[#2D3A3A] transition group-hover:scale-110">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M12 5v14m7-7H5" />
                </svg>
              </div>
              <p className="mt-4 font-semibold text-[#1F2937] transition group-hover:text-[#2D3A3A]">Shto Veturë të Re</p>
              <p className="mt-1 text-sm text-[#6B7280]">Regjistroni një veturë tjetër</p>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default MyGaragePage;
