import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    navigate("/login", { replace: true });
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
    <main className="relative min-h-screen bg-deep font-body text-white antialiased">
      {/* Premium background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(72,242,194,0.04),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(20,39,58,0.3),transparent_60%)]" />

      {/* Floating shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-mint/5 blur-3xl" />
        <div className="absolute -right-20 bottom-1/4 h-96 w-96 rounded-full bg-slateBlue/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-deep/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-mint/20 to-mint/5">
              <span className="font-display text-lg font-bold text-mint">V</span>
            </div>
            <span className="font-display text-xl font-bold">VeturaIme</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/car-setup"
              className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold transition hover:bg-white/10"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Shto Veturë</span>
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold transition hover:bg-white/15"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
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
          <p className="text-sm font-semibold uppercase tracking-widest text-mint/80">Garazhi im</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            {userName ? `Mirë se u ktheve, ${userName.split(" ")[0]}!` : "Veturat e mia"}
          </h1>
          <p className="mt-2 text-slate-400">
            Zgjidhni veturën për të parë panelin e plotë të menaxhimit
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-mint border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map((car, index) => {
              const colorInfo = COLORS.find((c) => c.value === car.color);

              return (
                <Link
                  key={car.id}
                  to={`/vehicle/${car.id}`}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 transition-all duration-300 hover:border-mint/30 hover:shadow-[0_30px_80px_rgba(72,242,194,0.15)]"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Primary badge */}
                  {car.is_primary && (
                    <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-mint/90 px-3 py-1 text-xs font-bold text-deep">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Kryesore
                    </div>
                  )}

                  {/* Car image */}
                  <div className="aspect-[16/10] overflow-hidden bg-deep/50">
                    {carImages[car.id] ? (
                      <img
                        src={getRenderableVehicleImageUrl(carImages[car.id]) ?? carImages[car.id]}
                        alt={`${car.make} ${car.model}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                  </div>

                  {/* Car info */}
                  <div className="relative p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-bold tracking-tight transition group-hover:text-mint">
                          {car.make} {car.model}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">{getCarDescription(car)}</p>
                      </div>
                      {colorInfo && (
                        <div
                          className="h-5 w-5 shrink-0 rounded-full border border-white/20"
                          style={{ backgroundColor: colorInfo.hex }}
                          title={colorInfo.label}
                        />
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="mt-4 flex flex-wrap gap-3">
                      {car.license_plate && (
                        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium">
                          {car.license_plate}
                        </div>
                      )}
                      {car.mileage && (
                        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300">
                          {car.mileage.toLocaleString("sq-AL")} km
                        </div>
                      )}
                    </div>

                    {/* Hover arrow */}
                    <div className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-mint/10 text-mint opacity-0 transition-all duration-300 group-hover:opacity-100">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Add new car card */}
            <Link
              to="/car-setup"
              className="group flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 bg-white/5 p-10 transition-all duration-300 hover:border-mint/30 hover:bg-white/10"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint/10 text-mint transition group-hover:bg-mint/20 group-hover:scale-110">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="mt-4 font-semibold text-slate-300 transition group-hover:text-white">Shto Veturë të Re</p>
              <p className="mt-1 text-sm text-slate-500">Regjistroni një veturë tjetër</p>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default MyGaragePage;
