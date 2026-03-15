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
  };

  const goToPreview = () => {
    if (!canProceedToPreview) return;
    setStep("preview");
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
    <main className="relative min-h-screen overflow-hidden bg-[#F9FAFB] px-4 py-8 font-body text-[#1F2937] antialiased md:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-[#b8c8c5]/20 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-[#c8d8eb]/20 blur-3xl" />
        <div className="absolute bottom-[-160px] left-1/3 h-[430px] w-[430px] rounded-full bg-[#2D3A3A]/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#4d675f]">Konfigurimi i Veturës</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-[#1F2937] md:text-4xl">
            {step === "identify" && "Identifikoni Veturën Tuaj"}
            {step === "details" && "Detajet e Veturës"}
            {step === "preview" && "Konfirmoni Veturën"}
          </h1>
          <p className="mt-2 text-[#6B7280]">
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
                    ? "bg-[#2D3A3A] text-white"
                    : i < ["identify", "details", "preview"].indexOf(step)
                      ? "bg-[#dce9e6] text-[#2D3A3A]"
                      : "bg-[#e8edf2] text-[#94a3b8]"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`h-0.5 w-8 rounded ${
                    i < ["identify", "details", "preview"].indexOf(step) ? "bg-[#b9cec9]" : "bg-[#e5e7eb]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="rounded-3xl bg-white p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.05)] md:p-8">
          {/* Step 1: Identify */}
          {step === "identify" && (
            <div className="space-y-6">
              {/* Make selection */}
              <div className="relative">
                <label className="mb-2 block text-sm font-semibold text-[#374151]">
                  Marka <span className="text-[#b42318]">*</span>
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
                    className="h-14 w-full rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 text-[#1F2937] placeholder-[#9ca3af] transition focus:border-[#9eb8b2] focus:outline-none focus:ring-2 focus:ring-[#b9cec9]/50"
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
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#1F2937]"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {showMakeDropdown && (
                  <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white shadow-[0px_10px_30px_rgba(0,0,0,0.08)]">
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
                        className={`w-full px-4 py-3 text-left transition hover:bg-[#f3f4f6] ${
                          m === make ? "bg-[#e7f1ee] text-[#2D3A3A]" : "text-[#374151]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    {/* Option to add custom make if searching */}
                    {makeSearch && !filteredMakes.some((m) => m.toLowerCase() === makeSearch.toLowerCase()) && (
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
                        className="w-full border-t border-[#e5e7eb] px-4 py-3 text-left text-[#2D3A3A] transition hover:bg-[#f3f4f6]"
                      >
                        + Shto "{makeSearch}" si markë
                      </button>
                    )}
                    {filteredMakes.length === 0 && !makeSearch && (
                      <div className="px-4 py-3 text-[#9ca3af]">Asnjë rezultat</div>
                    )}
                  </div>
                )}
              </div>

              {/* Model selection */}
              <div className="relative">
                <label className="mb-2 block text-sm font-semibold text-[#374151]">
                  Modeli <span className="text-[#b42318]">*</span>
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
                    className="h-14 w-full rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 text-[#1F2937] placeholder-[#9ca3af] transition focus:border-[#9eb8b2] focus:outline-none focus:ring-2 focus:ring-[#b9cec9]/50 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#1F2937]"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {showModelDropdown && make && (
                  <div className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white shadow-[0px_10px_30px_rgba(0,0,0,0.08)]">
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
                        className={`w-full px-4 py-3 text-left transition hover:bg-[#f3f4f6] ${
                          m === model ? "bg-[#e7f1ee] text-[#2D3A3A]" : "text-[#374151]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    {/* Custom model option */}
                    {modelSearch && !filteredModels.some((m) => m.toLowerCase() === modelSearch.toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setModel(modelSearch);
                          setModelSearch("");
                          setShowModelDropdown(false);
                        }}
                        className="w-full border-t border-[#e5e7eb] px-4 py-3 text-left text-[#2D3A3A] transition hover:bg-[#f3f4f6]"
                      >
                        + Shto "{modelSearch}" si model
                      </button>
                    )}
                    {filteredModels.length === 0 && !modelSearch && (
                      <div className="px-4 py-3 text-[#9ca3af]">Asnjë model i disponueshëm</div>
                    )}
                  </div>
                )}
              </div>

              {/* Year selection */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Viti</label>
                <select
                  value={year ?? ""}
                  onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
                  className="h-14 w-full appearance-none rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 text-[#1F2937] transition focus:border-[#9eb8b2] focus:outline-none focus:ring-2 focus:ring-[#b9cec9]/50"
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
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Targa</label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                  placeholder="p.sh. 01-ABC-123"
                  className={`h-14 w-full rounded-xl border bg-[#f8fafc] px-4 text-[#1F2937] uppercase placeholder-[#9ca3af] transition focus:outline-none focus:ring-2 ${
                    licensePlate && !licensePlateValid
                      ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                      : "border-[#e5e7eb] focus:border-[#9eb8b2] focus:ring-[#b9cec9]/50"
                  }`}
                />
                {licensePlate && !licensePlateValid && (
                  <p className="mt-1 text-xs text-[#b42318]">Formati i targës nuk është i saktë</p>
                )}
              </div>

              {/* VIN */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#374151]">VIN (Numri i Shasisë)</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="17 karaktere"
                  maxLength={17}
                  className={`h-14 w-full rounded-xl border bg-[#f8fafc] px-4 font-mono text-[#1F2937] uppercase placeholder-[#9ca3af] transition focus:outline-none focus:ring-2 ${
                    vin && !vinValid
                      ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                      : "border-[#e5e7eb] focus:border-[#9eb8b2] focus:ring-[#b9cec9]/50"
                  }`}
                />
                {vin && !vinValid && (
                  <p className="mt-1 text-xs text-[#b42318]">VIN duhet të ketë saktësisht 17 karaktere alfanumerike</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onSkip}
                  className="flex h-14 flex-1 items-center justify-center rounded-xl bg-[#f3f4f6] font-semibold text-[#4b5563] shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#e5e7eb]"
                >
                  Kalo
                </button>
                <button
                  type="button"
                  onClick={goToDetails}
                  disabled={!canProceedToDetails}
                  className="flex h-14 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#2D3A3A] font-bold text-white shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#253030] disabled:cursor-not-allowed disabled:bg-[#9ca3af] disabled:text-white/75 disabled:shadow-none"
                >
                  Vazhdo
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5l7 7-7 7" />
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
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Tipi i Karorisë</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {BODY_TYPES.map((bt) => (
                    <button
                      key={bt.value}
                      type="button"
                      onClick={() => setBodyType(bt.value)}
                      className={`rounded-xl p-3 text-center text-sm font-medium transition ${
                        bodyType === bt.value
                          ? "bg-[#e7f1ee] text-[#2D3A3A] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                          : "bg-[#f8fafc] text-[#6B7280] hover:bg-[#f1f5f9]"
                      }`}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fuel type */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Karburanti</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {FUEL_TYPES.map((ft) => (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setFuelType(ft.value)}
                      className={`rounded-xl p-3 text-center text-sm font-medium transition ${
                        fuelType === ft.value
                          ? "bg-[#e7f1ee] text-[#2D3A3A] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                          : "bg-[#f8fafc] text-[#6B7280] hover:bg-[#f1f5f9]"
                      }`}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transmission */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Transmisioni</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRANSMISSION_TYPES.map((tt) => (
                    <button
                      key={tt.value}
                      type="button"
                      onClick={() => setTransmission(tt.value)}
                      className={`rounded-xl p-3 text-center text-sm font-medium transition ${
                        transmission === tt.value
                          ? "bg-[#e7f1ee] text-[#2D3A3A] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                          : "bg-[#f8fafc] text-[#6B7280] hover:bg-[#f1f5f9]"
                      }`}
                    >
                      {tt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Ngjyra</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        color === c.value
                          ? "bg-[#e7f1ee] text-[#2D3A3A] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                          : "bg-[#f8fafc] text-[#6B7280] hover:bg-[#f1f5f9]"
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.75),0px_2px_8px_rgba(0,0,0,0.16)]"
                        style={{ backgroundColor: c.hex }}
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Usage type */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Përdorimi</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {USAGE_TYPES.map((ut) => (
                    <button
                      key={ut.value}
                      type="button"
                      onClick={() => setUsageType(ut.value)}
                      className={`rounded-xl p-3 text-center text-sm font-medium transition ${
                        usageType === ut.value
                          ? "bg-[#e7f1ee] text-[#2D3A3A] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                          : "bg-[#f8fafc] text-[#6B7280] hover:bg-[#f1f5f9]"
                      }`}
                    >
                      {ut.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mileage */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#374151]">Kilometrazhi</label>
                <div className="relative">
                  <input
                    type="number"
                    value={mileage ?? ""}
                    onChange={(e) => setMileage(e.target.value ? Number(e.target.value) : null)}
                    placeholder="p.sh. 85000"
                    min={0}
                    className="h-14 w-full rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 pr-14 text-[#1F2937] placeholder-[#9ca3af] transition focus:border-[#9eb8b2] focus:outline-none focus:ring-2 focus:ring-[#b9cec9]/50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af]">km</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#f3f4f6] px-6 font-semibold text-[#4b5563] shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#e5e7eb]"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 19l-7-7 7-7" />
                  </svg>
                  Mbrapa
                </button>
                <button
                  type="button"
                  onClick={goToPreview}
                  disabled={!canProceedToPreview}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2D3A3A] font-bold text-white shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#253030] disabled:cursor-not-allowed disabled:bg-[#9ca3af] disabled:text-white/75 disabled:shadow-none"
                >
                  Vazhdo
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-6">
              {/* Vehicle image */}
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#ffffff,#f3f7fb)] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                {fetchingImage ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#2D3A3A] border-t-transparent" />
                  </div>
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`${make} ${model}`}
                    className="h-full w-full object-contain p-6 drop-shadow-[0px_16px_24px_rgba(0,0,0,0.14)]"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#9ca3af]">
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
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/80 to-transparent p-4">
                  <h2 className="font-display text-2xl font-bold text-[#1F2937]">
                    {make} {model}
                  </h2>
                  <p className="text-[#6B7280]">
                    {year && `${year} • `}
                    {BODY_TYPES.find((b) => b.value === bodyType)?.label || "Veturë"}
                  </p>
                </div>
              </div>

              {/* Vehicle details grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {licensePlate && (
                  <div className="rounded-xl bg-[#f8fafc] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <p className="text-xs text-[#9ca3af]">Targa</p>
                    <p className="mt-1 font-mono text-lg font-bold text-[#1F2937]">{licensePlate}</p>
                  </div>
                )}
                {vin && (
                  <div className="rounded-xl bg-[#f8fafc] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <p className="text-xs text-[#9ca3af]">VIN</p>
                    <p className="mt-1 font-mono text-sm text-[#1F2937]">{vin}</p>
                  </div>
                )}
                {fuelType && (
                  <div className="rounded-xl bg-[#f8fafc] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <p className="text-xs text-[#9ca3af]">Karburanti</p>
                    <p className="mt-1 font-semibold text-[#1F2937]">{FUEL_TYPES.find((f) => f.value === fuelType)?.label}</p>
                  </div>
                )}
                {transmission && (
                  <div className="rounded-xl bg-[#f8fafc] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <p className="text-xs text-[#9ca3af]">Transmisioni</p>
                    <p className="mt-1 font-semibold text-[#1F2937]">
                      {TRANSMISSION_TYPES.find((t) => t.value === transmission)?.label}
                    </p>
                  </div>
                )}
                {color && (
                  <div className="rounded-xl bg-[#f8fafc] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <p className="text-xs text-[#9ca3af]">Ngjyra</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.75),0px_2px_8px_rgba(0,0,0,0.16)]"
                        style={{ backgroundColor: COLORS.find((c) => c.value === color)?.hex }}
                      />
                      <span className="font-semibold text-[#1F2937]">{COLORS.find((c) => c.value === color)?.label}</span>
                    </div>
                  </div>
                )}
                {mileage && (
                  <div className="rounded-xl bg-[#f8fafc] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <p className="text-xs text-[#9ca3af]">Kilometrazhi</p>
                    <p className="mt-1 font-semibold text-[#1F2937]">{mileage.toLocaleString("sq-AL")} km</p>
                  </div>
                )}
                {usageType && (
                  <div className="rounded-xl bg-[#f8fafc] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    <p className="text-xs text-[#9ca3af]">Përdorimi</p>
                    <p className="mt-1 font-semibold text-[#1F2937]">{USAGE_TYPES.find((u) => u.value === usageType)?.label}</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-[#fff2f2] px-4 py-3 text-center text-sm font-medium text-[#b42318] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#f3f4f6] px-6 font-semibold text-[#4b5563] shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#e5e7eb] disabled:opacity-50"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 19l-7-7 7-7" />
                  </svg>
                  Ndrysho
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={loading}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2D3A3A] font-bold text-white shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#253030] disabled:opacity-50"
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
