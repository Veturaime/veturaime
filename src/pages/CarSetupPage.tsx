import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CarInput } from "../lib/database.types";
import { createCar, supabase } from "../lib/supabase";
import {
  BODY_TYPES,
  CAR_MAKES,
  CAR_MODELS,
  COLORS,
  fetchVehicleImage,
  FUEL_TYPES,
  getYearOptions,
  TRANSMISSION_TYPES,
  USAGE_TYPES,
  validateLicensePlate,
  validateVIN
} from "../lib/vehicle-data";

type SetupStep = "identify" | "details" | "preview";

function CarSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>("identify");
  const [loading, setLoading] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [error, setError] = useState("");

  // Car identification
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [licensePlate, setLicensePlate] = useState("");
  const [vin, setVin] = useState("");

  // Car details
  const [bodyType, setBodyType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [transmission, setTransmission] = useState("");
  const [color, setColor] = useState("");
  const [usageType, setUsageType] = useState("");
  const [mileage, setMileage] = useState<number | null>(null);

  // Preview
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Dropdowns
  const [showMakeDropdown, setShowMakeDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [makeSearch, setMakeSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");

  const years = useMemo(() => getYearOptions(), []);
  const availableModels = useMemo(() => CAR_MODELS[make] || [], [make]);

  const filteredMakes = useMemo(() => {
    if (!makeSearch) return [...CAR_MAKES];
    const search = makeSearch.toLowerCase();
    return CAR_MAKES.filter((m) => m.toLowerCase().includes(search));
  }, [makeSearch]);

  const filteredModels = useMemo(() => {
    if (!modelSearch) return availableModels;
    const search = modelSearch.toLowerCase();
    return availableModels.filter((m) => m.toLowerCase().includes(search));
  }, [modelSearch, availableModels]);

  // Guard - only check authentication
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (!data.user) {
        navigate("/login", { replace: true });
        return;
      }
    };

    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Fetch image when make/model changes
  useEffect(() => {
    if (!make || !model) {
      setImageUrl(null);
      return;
    }

    const fetchImage = async () => {
      setFetchingImage(true);
      try {
        const resolvedUrl = await fetchVehicleImage(
          make,
          model,
          year ?? undefined,
          bodyType || undefined,
          color || undefined
        );
        setImageUrl(resolvedUrl);
      } catch {
        setImageUrl(null);
      } finally {
        setFetchingImage(false);
      }
    };

    void fetchImage();
  }, [make, model, year, bodyType, color]);

  const canProceedToDetails = make && model;
  const canProceedToPreview = make && model;

  const licensePlateValid = !licensePlate || validateLicensePlate(licensePlate);
  const vinValid = !vin || validateVIN(vin);

  const goToDetails = () => {
    if (!canProceedToDetails) return;
    setStep("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToPreview = () => {
    if (!canProceedToPreview) return;
    setStep("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    if (step === "details") setStep("identify");
    else if (step === "preview") setStep("details");
  };

  const onSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const carData: CarInput = {
        make,
        model,
        year,
        license_plate: licensePlate || null,
        vin: vin || null,
        body_type: bodyType || null,
        fuel_type: fuelType || null,
        transmission: transmission || null,
        color: color || null,
        usage_type: usageType || null,
        mileage,
        image_url: imageUrl,
        is_primary: true
      };

      const car = await createCar(carData);
      navigate(`/vehicle/${car.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Krijimi i veturës dështoi.");
    } finally {
      setLoading(false);
    }
  };

  const onSkip = () => {
    navigate("/my-garage", { replace: true });
  };

  return (
    <main className="relative min-h-screen bg-deep px-4 py-8 font-body text-white antialiased md:py-12">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(72,242,194,0.05),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(20,39,58,0.4),transparent_50%)]" />

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-mint/80">Konfigurimi i Veturës</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
            {step === "identify" && "Identifikoni Veturën Tuaj"}
            {step === "details" && "Detajet e Veturës"}
            {step === "preview" && "Konfirmoni Veturën"}
          </h1>
          <p className="mt-2 text-slate-400">
            {step === "identify" && "Zgjidhni markën, modelin dhe vitin e veturës suaj"}
            {step === "details" && "Plotësoni informacionet shtesë për menaxhim më të mirë"}
            {step === "preview" && "Rishikoni dhe konfirmoni informacionin"}
          </p>
        </div>

        {/* Progress steps */}
        <div className="mb-10 flex items-center justify-center gap-2">
          {["identify", "details", "preview"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                  step === s
                    ? "bg-mint text-deep"
                    : i < ["identify", "details", "preview"].indexOf(step)
                      ? "bg-mint/30 text-mint"
                      : "bg-white/10 text-slate-500"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`h-0.5 w-8 rounded ${
                    i < ["identify", "details", "preview"].indexOf(step) ? "bg-mint/50" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl md:p-8">
          {/* Step 1: Identify */}
          {step === "identify" && (
            <div className="space-y-6">
              {/* Make selection */}
              <div className="relative">
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Marka <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={makeSearch !== "" ? makeSearch : make}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMakeSearch(val);
                      setShowMakeDropdown(true);
                      // If user clears the input, also clear make
                      if (!val) {
                        setMake("");
                        setModel("");
                        setModelSearch("");
                      }
                    }}
                    onFocus={() => setShowMakeDropdown(true)}
                    onBlur={() => {
                      // Delay to allow click on dropdown
                      setTimeout(() => {
                        // If there's a search term but no make selected, use the search term as custom make
                        if (makeSearch && !make) {
                          setMake(makeSearch);
                        }
                        setMakeSearch("");
                        setShowMakeDropdown(false);
                      }, 200);
                    }}
                    placeholder="p.sh. Mercedes-Benz, Volkswagen, Audi..."
                    className="h-14 w-full rounded-xl border border-white/15 bg-deep/50 px-4 text-white placeholder-slate-500 transition focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/20"
                  />
                  {(make || makeSearch) && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                      onClick={() => {
                        setMake("");
                        setMakeSearch("");
                        setModel("");
                        setModelSearch("");
                        setShowMakeDropdown(false);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {showMakeDropdown && (
                  <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-white/15 bg-slate-900 shadow-xl">
                    {filteredMakes.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                        onClick={() => {
                          setMake(m);
                          setMakeSearch("");
                          setShowMakeDropdown(false);
                          setModel("");
                          setModelSearch("");
                        }}
                        className={`w-full px-4 py-3 text-left transition hover:bg-white/10 ${
                          m === make ? "bg-mint/10 text-mint" : "text-white"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    {/* Option to add custom make if searching */}
                    {makeSearch && !filteredMakes.some(m => m.toLowerCase() === makeSearch.toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setMake(makeSearch);
                          setMakeSearch("");
                          setShowMakeDropdown(false);
                          setModel("");
                          setModelSearch("");
                        }}
                        className="w-full border-t border-white/10 px-4 py-3 text-left text-mint transition hover:bg-white/10"
                      >
                        + Shto "{makeSearch}" si markë
                      </button>
                    )}
                    {filteredMakes.length === 0 && !makeSearch && (
                      <div className="px-4 py-3 text-slate-400">Asnjë rezultat</div>
                    )}
                  </div>
                )}
              </div>

              {/* Model selection */}
              <div className="relative">
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Modeli <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={modelSearch !== "" ? modelSearch : model}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModelSearch(val);
                      setShowModelDropdown(true);
                      if (!val) setModel("");
                    }}
                    onFocus={() => make && setShowModelDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        // If there's a search term but no model selected, use the search term as custom model
                        if (modelSearch && !model) {
                          setModel(modelSearch);
                        }
                        setModelSearch("");
                        setShowModelDropdown(false);
                      }, 200);
                    }}
                    placeholder={make ? "Zgjidhni modelin..." : "Zgjidhni markën së pari"}
                    disabled={!make}
                    className="h-14 w-full rounded-xl border border-white/15 bg-deep/50 px-4 text-white placeholder-slate-500 transition focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {(model || modelSearch) && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setModel("");
                        setModelSearch("");
                        setShowModelDropdown(false);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {showModelDropdown && make && (
                  <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-white/15 bg-slate-900 shadow-xl">
                    {filteredModels.map((m) => (
                      <button
                        key={m}
                        onMouseDown={(e) => e.preventDefault()}
                        type="button"
                        onClick={() => {
                          setModel(m);
                          setModelSearch("");
                          setShowModelDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left transition hover:bg-white/10 ${
                          m === model ? "bg-mint/10 text-mint" : "text-white"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    {/* Custom model option */}
                    {modelSearch && !filteredModels.some(m => m.toLowerCase() === modelSearch.toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setModel(modelSearch);
                          setModelSearch("");
                          setShowModelDropdown(false);
                        }}
                        className="w-full border-t border-white/10 px-4 py-3 text-left text-mint transition hover:bg-white/10"
                      >
                        + Shto "{modelSearch}" si model
                      </button>
                    )}
                    {filteredModels.length === 0 && !modelSearch && (
                      <div className="px-4 py-3 text-slate-400">Asnjë model i disponueshëm</div>
                    )}
                  </div>
                )}
              </div>

              {/* Year selection */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Viti</label>
                <select
                  value={year ?? ""}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
                  className="h-14 w-full appearance-none rounded-xl border border-white/15 bg-deep/50 px-4 text-white transition focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/20"
                >
                  <option value="">Zgjidhni vitin...</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* License plate */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Targa</label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                  placeholder="p.sh. 01-ABC-123"
                  className={`h-14 w-full rounded-xl border bg-deep/50 px-4 text-white uppercase placeholder-slate-500 transition focus:outline-none focus:ring-2 ${
                    licensePlate && !licensePlateValid
                      ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                      : "border-white/15 focus:border-mint/50 focus:ring-mint/20"
                  }`}
                />
                {licensePlate && !licensePlateValid && (
                  <p className="mt-1 text-xs text-red-400">Formati i targës nuk është i saktë</p>
                )}
              </div>

              {/* VIN */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">VIN (Numri i Shasisë)</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="17 karaktere"
                  maxLength={17}
                  className={`h-14 w-full rounded-xl border bg-deep/50 px-4 font-mono text-white uppercase placeholder-slate-500 transition focus:outline-none focus:ring-2 ${
                    vin && !vinValid
                      ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                      : "border-white/15 focus:border-mint/50 focus:ring-mint/20"
                  }`}
                />
                {vin && !vinValid && (
                  <p className="mt-1 text-xs text-red-400">VIN duhet të ketë saktësisht 17 karaktere alfanumerike</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onSkip}
                  className="flex h-14 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 font-semibold text-slate-300 transition hover:bg-white/10"
                >
                  Kalo
                </button>
                <button
                  type="button"
                  onClick={goToDetails}
                  disabled={!canProceedToDetails}
                  className="flex h-14 flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint to-emerald-400 font-bold text-deep shadow-[0_8px_30px_rgba(72,242,194,0.25)] transition hover:shadow-[0_12px_40px_rgba(72,242,194,0.35)] disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-600 disabled:text-slate-400 disabled:shadow-none"
                >
                  Vazhdo
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === "details" && (
            <div className="space-y-6">
              {/* Body type */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Tipi i Karorisë</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {BODY_TYPES.map((bt) => (
                    <button
                      key={bt.value}
                      type="button"
                      onClick={() => setBodyType(bt.value)}
                      className={`rounded-xl border p-3 text-center text-sm font-medium transition ${
                        bodyType === bt.value
                          ? "border-mint/50 bg-mint/10 text-mint"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fuel type */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Karburanti</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {FUEL_TYPES.map((ft) => (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setFuelType(ft.value)}
                      className={`rounded-xl border p-3 text-center text-sm font-medium transition ${
                        fuelType === ft.value
                          ? "border-mint/50 bg-mint/10 text-mint"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transmission */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Transmisioni</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRANSMISSION_TYPES.map((tt) => (
                    <button
                      key={tt.value}
                      type="button"
                      onClick={() => setTransmission(tt.value)}
                      className={`rounded-xl border p-3 text-center text-sm font-medium transition ${
                        transmission === tt.value
                          ? "border-mint/50 bg-mint/10 text-mint"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {tt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Ngjyra</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        color === c.value
                          ? "border-mint/50 bg-mint/10 text-mint"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Usage type */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Përdorimi</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {USAGE_TYPES.map((ut) => (
                    <button
                      key={ut.value}
                      type="button"
                      onClick={() => setUsageType(ut.value)}
                      className={`rounded-xl border p-3 text-center text-sm font-medium transition ${
                        usageType === ut.value
                          ? "border-mint/50 bg-mint/10 text-mint"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {ut.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mileage */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Kilometrazhi</label>
                <div className="relative">
                  <input
                    type="number"
                    value={mileage ?? ""}
                    onChange={(e) => setMileage(e.target.value ? Number(e.target.value) : null)}
                    placeholder="p.sh. 85000"
                    min={0}
                    className="h-14 w-full rounded-xl border border-white/15 bg-deep/50 px-4 pr-14 text-white placeholder-slate-500 transition focus:border-mint/50 focus:outline-none focus:ring-2 focus:ring-mint/20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">km</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Mbrapa
                </button>
                <button
                  type="button"
                  onClick={goToPreview}
                  disabled={!canProceedToPreview}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint to-emerald-400 font-bold text-deep shadow-[0_8px_30px_rgba(72,242,194,0.25)] transition hover:shadow-[0_12px_40px_rgba(72,242,194,0.35)] disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-600 disabled:text-slate-400 disabled:shadow-none"
                >
                  Vazhdo
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-6">
              {/* Vehicle image */}
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-deep/50">
                {fetchingImage ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-mint border-t-transparent" />
                  </div>
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`${make} ${model}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-deep/90 to-transparent p-4">
                  <h2 className="font-display text-2xl font-bold">
                    {make} {model}
                  </h2>
                  <p className="text-slate-300">
                    {year && `${year} • `}
                    {BODY_TYPES.find((b) => b.value === bodyType)?.label || "Veturë"}
                  </p>
                </div>
              </div>

              {/* Vehicle details grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {licensePlate && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">Targa</p>
                    <p className="mt-1 font-mono text-lg font-bold">{licensePlate}</p>
                  </div>
                )}
                {vin && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">VIN</p>
                    <p className="mt-1 font-mono text-sm">{vin}</p>
                  </div>
                )}
                {fuelType && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">Karburanti</p>
                    <p className="mt-1 font-semibold">{FUEL_TYPES.find((f) => f.value === fuelType)?.label}</p>
                  </div>
                )}
                {transmission && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">Transmisioni</p>
                    <p className="mt-1 font-semibold">
                      {TRANSMISSION_TYPES.find((t) => t.value === transmission)?.label}
                    </p>
                  </div>
                )}
                {color && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">Ngjyra</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: COLORS.find((c) => c.value === color)?.hex }}
                      />
                      <span className="font-semibold">{COLORS.find((c) => c.value === color)?.label}</span>
                    </div>
                  </div>
                )}
                {mileage && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">Kilometrazhi</p>
                    <p className="mt-1 font-semibold">{mileage.toLocaleString("sq-AL")} km</p>
                  </div>
                )}
                {usageType && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">Përdorimi</p>
                    <p className="mt-1 font-semibold">{USAGE_TYPES.find((u) => u.value === usageType)?.label}</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-medium text-red-300">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Ndrysho
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={loading}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint to-emerald-400 font-bold text-deep shadow-[0_8px_30px_rgba(72,242,194,0.25)] transition hover:shadow-[0_12px_40px_rgba(72,242,194,0.35)] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Duke ruajtur...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Konfirmo dhe Vazhdo
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </main>
  );
}

export default CarSetupPage;
