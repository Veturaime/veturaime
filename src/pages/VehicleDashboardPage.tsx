import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { DocumentRow, ExpenseRow, ServiceRecordRow } from "../lib/database.types";
import {
  createDocument,
  createExpense,
  createServiceRecord,
  deleteServiceRecord,
  getVehicleDashboardData,
  supabase,
  updateServiceRecord,
  type VehicleDashboardData,
  updateCar
} from "../lib/supabase";
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

const todayIso = new Date().toISOString().split("T")[0];

type DocumentFilter = "all" | "expiring" | "expired";
type DocumentKind = "registration" | "insurance" | "inspection" | "authorization" | "invoice" | "manual";
type ServiceKind = "oil_change" | "brakes" | "tires" | "battery" | "antifreeze" | "general" | "other";
type ExpenseKind = "fuel" | "service" | "documents" | "parts" | "parking_fines" | "other";
type ReportEventFilter = "documents" | "services" | "expenses";

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

function getDocumentReportStatus(expiresOn: string | null): "ok" | "expiring" | "expired" {
  const days = getDaysUntil(expiresOn);

  if (days === null) return "ok";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "ok";
}

// Document type icons and labels
const DOCUMENT_TYPES: Record<string, { label: string; icon: string }> = {
  registration: { label: "Regjistrimi", icon: "📋" },
  insurance: { label: "Sigurimi", icon: "🛡️" },
  inspection: { label: "Kontrolli Teknik", icon: "🔧" },
  authorization: { label: "Leja/Autorizim", icon: "🪪" },
  invoice: { label: "Faturë / Kupon", icon: "🧾" },
  manual: { label: "Manual / të tjera", icon: "📘" },
  license: { label: "Leja/Autorizim", icon: "🪪" },
  tax: { label: "Faturë / Kupon", icon: "🧾" },
  warranty: { label: "Manual / të tjera", icon: "📘" },
  other: { label: "Tjetër", icon: "📄" }
};

const DOCUMENT_KIND_OPTIONS: Array<{ value: DocumentKind; label: string }> = [
  { value: "registration", label: "Regjistrimi" },
  { value: "insurance", label: "Sigurimi" },
  { value: "inspection", label: "Kontrolli teknik" },
  { value: "authorization", label: "Leja/Autorizim" },
  { value: "invoice", label: "Faturë / Kupon" },
  { value: "manual", label: "Manual / të tjera" }
];

const SERVICE_KIND_OPTIONS: Array<{ value: ServiceKind; label: string }> = [
  { value: "oil_change", label: "Ndërrim vaji + filtra" },
  { value: "brakes", label: "Frenat (para/mbrapa)" },
  { value: "tires", label: "Gomat (verë/dimër/all-season)" },
  { value: "battery", label: "Bateria" },
  { value: "antifreeze", label: "Antifriz" },
  { value: "general", label: "Servis i përgjithshëm" },
  { value: "other", label: "Tjera" }
];

const EXPENSE_KIND_OPTIONS: Array<{ value: ExpenseKind; label: string }> = [
  { value: "fuel", label: "Karburant" },
  { value: "service", label: "Servis/ mirëmbajtje" },
  { value: "documents", label: "Dokumente (regjistrim/sigurim)" },
  { value: "parts", label: "Pjesë (blerë veç)" },
  { value: "parking_fines", label: "Parkim/Gjoba" },
  { value: "other", label: "Tjera" }
];

const REPORT_MONTH_OPTIONS = [
  "Janar",
  "Shkurt",
  "Mars",
  "Prill",
  "Maj",
  "Qershor",
  "Korrik",
  "Gusht",
  "Shtator",
  "Tetor",
  "Nëntor",
  "Dhjetor"
];

function buildNotes(baseNotes: string, details: Array<[string, string | null | undefined]>) {
  const cleanBase = baseNotes.trim();
  const detailLines = details
    .filter(([, value]) => Boolean(value && String(value).trim()))
    .map(([label, value]) => `${label}: ${String(value).trim()}`);

  if (cleanBase && detailLines.length === 0) return cleanBase;
  if (!cleanBase && detailLines.length === 0) return null;

  return [cleanBase, ...detailLines].filter(Boolean).join("\n");
}

function getYear(dateValue: string | null) {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
}

function getMonth(dateValue: string | null) {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getMonth() + 1;
}

function addOneYear(dateValue: string) {
  const normalized = normalizeDateInput(dateValue);
  if (!normalized) return "";

  const [yearText, monthText, dayText] = normalized.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);

  const next = new Date(Date.UTC(year + 1, monthIndex, day));
  if (Number.isNaN(next.getTime())) return "";

  return next.toISOString().slice(0, 10);
}

function normalizeDateInput(value: string) {
  const clean = value.trim();
  if (!clean) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const parts = clean.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map((part) => part.trim());
    if (day.length >= 1 && month.length >= 1 && year.length === 4) {
      const dd = day.padStart(2, "0");
      const mm = month.padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  return "";
}

function formatIsoToDmy(value: string) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "";

  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

type Tab = "overview" | "documents" | "services" | "expenses" | "reports";

function VehicleDashboardPage() {
  const { carId } = useParams<{ carId: string }>();
  const navigate = useNavigate();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [data, setData] = useState<VehicleDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [carImage, setCarImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>("all");
  const [documentType, setDocumentType] = useState<DocumentKind>("registration");
  const [documentTitle, setDocumentTitle] = useState("Regjistrimi");
  const [documentIssuedOn, setDocumentIssuedOn] = useState(todayIso);
  const [documentExpiresOn, setDocumentExpiresOn] = useState("");
  const [documentNotes, setDocumentNotes] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [inspectionCompleted, setInspectionCompleted] = useState("po");

  const [serviceType, setServiceType] = useState<ServiceKind>("oil_change");
  const [serviceDate, setServiceDate] = useState(todayIso);
  const [serviceMileage, setServiceMileage] = useState("");
  const [serviceProvider, setServiceProvider] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [serviceNextDate, setServiceNextDate] = useState("");
  const [serviceNextKm, setServiceNextKm] = useState("");
  const [oilFilter, setOilFilter] = useState(false);
  const [airFilter, setAirFilter] = useState(false);
  const [fuelFilter, setFuelFilter] = useState(false);
  const [cabinFilter, setCabinFilter] = useState(false);
  const [tireSeason, setTireSeason] = useState("dimër");
  const [tireBalancing, setTireBalancing] = useState("po");
  const [brakeAxle, setBrakeAxle] = useState("para");
  const [brakeDiscs, setBrakeDiscs] = useState("jo");
  const [brakePads, setBrakePads] = useState("po");
  const [batteryReplaced, setBatteryReplaced] = useState("po");
  const [antifreezeWinterLevel, setAntifreezeWinterLevel] = useState("-20");
  const [otherServiceCustomLabel, setOtherServiceCustomLabel] = useState("");

  const [expenseDate, setExpenseDate] = useState(todayIso);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseKind>("fuel");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null);

  const [reportYear, setReportYear] = useState<string>(String(currentYear));
  const [reportMonth, setReportMonth] = useState<string>(String(currentMonth));
  const [reportEventFilter, setReportEventFilter] = useState<ReportEventFilter>("expenses");

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

  const documentFilterStats = useMemo(() => {
    if (!data) {
      return { all: 0, expiring: 0, expired: 0 };
    }

    return data.documents.reduce(
      (acc, document) => {
        const status = getDocumentReportStatus(document.expires_on);
        acc.all += 1;
        if (status === "expiring") acc.expiring += 1;
        if (status === "expired") acc.expired += 1;
        return acc;
      },
      { all: 0, expiring: 0, expired: 0 }
    );
  }, [data]);

  const filteredDocuments = useMemo(() => {
    if (!data) return [];

    return data.documents.filter((document) => {
      const status = getDocumentReportStatus(document.expires_on);

      if (documentFilter === "expiring") return status === "expiring";
      if (documentFilter === "expired") return status === "expired";
      return true;
    });
  }, [data, documentFilter]);

  const availableReportYears = useMemo(() => {
    if (!data) {
      return [currentYear];
    }

    const years = new Set<number>();

    data.expenses.forEach((expense) => {
      const year = getYear(expense.expense_date);
      if (year) years.add(year);
    });

    data.serviceRecords.forEach((service) => {
      const year = getYear(service.service_date);
      if (year) years.add(year);
    });

    data.documents.forEach((document) => {
      const issueYear = getYear(document.issued_on);
      const expiryYear = getYear(document.expires_on);
      if (issueYear) years.add(issueYear);
      if (expiryYear) years.add(expiryYear);
    });

    years.add(currentYear);

    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, data]);

  const reportExpenses = useMemo(() => {
    if (!data) return [];

    return data.expenses.filter((expense) => {
      const year = getYear(expense.expense_date);
      const month = getMonth(expense.expense_date);
      const yearMatch = reportYear === "all" || year === Number(reportYear);
      const monthMatch = reportMonth === "all" || month === Number(reportMonth);
      return yearMatch && monthMatch;
    });
  }, [data, reportMonth, reportYear]);

  const reportServices = useMemo(() => {
    if (!data) return [];

    return data.serviceRecords.filter((service) => {
      const year = getYear(service.service_date);
      const month = getMonth(service.service_date);
      const yearMatch = reportYear === "all" || year === Number(reportYear);
      const monthMatch = reportMonth === "all" || month === Number(reportMonth);
      return yearMatch && monthMatch;
    });
  }, [data, reportMonth, reportYear]);

  const reportDocuments = useMemo(() => {
    if (!data) return [];

    return data.documents.filter((document) => {
      const referenceDate = document.expires_on ?? document.issued_on;
      const year = getYear(referenceDate);
      const month = getMonth(referenceDate);
      const yearMatch = reportYear === "all" || year === Number(reportYear);
      const monthMatch = reportMonth === "all" || month === Number(reportMonth);
      return yearMatch && monthMatch;
    });
  }, [data, reportMonth, reportYear]);

  const reportHistoryRows = useMemo(() => {
    const expenseRows = reportExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.expense_date,
      label: expense.category,
      source: "Shpenzim",
      amount: Number(expense.amount),
      kind: "expenses" as const
    }));

    const serviceRows = reportServices.map((service) => ({
      id: `service-${service.id}`,
      date: service.service_date,
      label: service.service_type,
      source: "Servisim",
      amount: Number(service.cost),
      kind: "services" as const
    }));

    const documentRows = reportDocuments.map((document) => ({
      id: `document-${document.id}`,
      date: document.expires_on ?? document.issued_on ?? document.created_at,
      label: DOCUMENT_TYPES[document.document_type]?.label ?? document.document_type,
      source: "Dokument",
      amount: null,
      kind: "documents" as const
    }));

    return [...expenseRows, ...serviceRows, ...documentRows]
      .filter((row) => row.kind === reportEventFilter)
      .sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
    );
  }, [reportDocuments, reportEventFilter, reportExpenses, reportServices]);

  useEffect(() => {
    const option = DOCUMENT_KIND_OPTIONS.find((item) => item.value === documentType);
    if (option) {
      setDocumentTitle(option.label);
    }
  }, [documentType]);

  const uploadFileToStorage = async (file: File, folder: "documents" | "receipts") => {
    if (!data) return null;

    const safeFileName = file.name.replace(/\s+/g, "-").toLowerCase();
    const path = `${data.car.owner_id}/${data.car.id}/${folder}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage.from("vehicle-files").upload(path, file, {
      upsert: false
    });

    if (uploadError) {
      throw new Error("Ngarkimi i skedarit dështoi. Kontrollo bucket-in 'vehicle-files'.");
    }

    const { data: publicData } = supabase.storage.from("vehicle-files").getPublicUrl(path);
    return publicData.publicUrl;
  };

  const refreshData = async () => {
    if (!carId) return;
    const freshData = await getVehicleDashboardData(carId);
    setData(freshData);
  };

  const handleCreateDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) return;

    setSaving(true);
    setFormError("");

    try {
      const uploadedFileUrl = documentFile ? await uploadFileToStorage(documentFile, "documents") : null;
      const normalizedIssuedDate = normalizeDateInput(documentIssuedOn);
      const registrationExpiry = addOneYear(documentIssuedOn);

      if (["registration", "insurance", "inspection"].includes(documentType) && !normalizedIssuedDate) {
        throw new Error("Data nuk është valide. Përdor formatin dd/mm/yyyy ose yyyy-mm-dd.");
      }

      if (documentType === "registration" && !registrationExpiry) {
        throw new Error("Data e skadimit nuk u llogarit. Kontrollo datën e regjistrimit.");
      }

      const issuedOn =
        documentType === "registration" || documentType === "insurance" || documentType === "inspection"
          ? normalizedIssuedDate || null
          : null;

      const expiresOn =
        documentType === "registration"
          ? registrationExpiry || null
          : documentType === "manual" || documentType === "authorization"
            ? documentExpiresOn || null
            : null;

      const mergedNotes =
        documentType === "inspection"
          ? buildNotes(documentNotes, [["Kontrolla teknike", inspectionCompleted]])
          : documentNotes.trim() || null;

      const status = getDocumentReportStatus(expiresOn) === "expired" ? "expired" : "active";

      await createDocument({
        owner_id: data.car.owner_id,
        car_id: data.car.id,
        document_type: documentType,
        reference_number: documentTitle.trim() || null,
        issued_on: issuedOn,
        expires_on: expiresOn,
        notes: mergedNotes,
        file_url: uploadedFileUrl,
        status
      });

      await refreshData();

      setDocumentIssuedOn(todayIso);
      setDocumentExpiresOn("");
      setDocumentNotes("");
      setDocumentFile(null);
      setInspectionCompleted("po");
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Ruajtja e dokumentit dështoi.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) return;

    setSaving(true);
    setFormError("");

    try {
      const selectedServiceLabel = SERVICE_KIND_OPTIONS.find((option) => option.value === serviceType)?.label ?? "Servis";
      const serviceLabel = serviceType === "other" ? otherServiceCustomLabel.trim() || "Tjera" : selectedServiceLabel;

      const details: Array<[string, string | null]> = [];

      if (serviceType === "oil_change") {
        details.push([
          "Filtrat",
          [
            oilFilter ? "vaj" : "",
            airFilter ? "ajër" : "",
            fuelFilter ? "naftë" : "",
            cabinFilter ? "kabinë" : ""
          ]
            .filter(Boolean)
            .join(", ") || null
        ]);
      }

      if (serviceType === "tires") {
        details.push(["Sezoni", tireSeason]);
        details.push(["Balancim", tireBalancing]);
      }

      if (serviceType === "brakes") {
        details.push(["Aksi", brakeAxle]);
        details.push(["Disqe", brakeDiscs]);
        details.push(["Pllaka", brakePads]);
      }

      if (serviceType === "battery") {
        details.push(["Bateri e re", batteryReplaced]);
      }

      if (serviceType === "antifreeze") {
        details.push(["Antifriz dimri", antifreezeWinterLevel]);
      }

      if (serviceType === "other") {
        details.push(["Plani KM", serviceNextKm || null]);
      }

      await createServiceRecord({
        owner_id: data.car.owner_id,
        car_id: data.car.id,
        service_date: serviceDate,
        service_type: serviceLabel,
        provider: serviceType === "other" ? serviceProvider.trim() || null : null,
        cost: serviceType === "other" ? (serviceCost ? Number(serviceCost) : 0) : 0,
        mileage: serviceType === "oil_change" || serviceType === "other" ? (serviceMileage ? Number(serviceMileage) : null) : null,
        notes: buildNotes(serviceNotes, details),
        next_service_due_at: serviceType === "other" ? serviceNextDate || null : null
      });

      await refreshData();

      setServiceDate(todayIso);
      setServiceMileage("");
      setServiceProvider("");
      setServiceCost("");
      setServiceNotes("");
      setServiceNextDate("");
      setServiceNextKm("");
      setOilFilter(false);
      setAirFilter(false);
      setFuelFilter(false);
      setCabinFilter(false);
      setBatteryReplaced("po");
      setAntifreezeWinterLevel("-20");
      setOtherServiceCustomLabel("");
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Ruajtja e servisimit dështoi.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!data) return;

    setSaving(true);
    setFormError("");

    try {
      const categoryLabel = EXPENSE_KIND_OPTIONS.find((option) => option.value === expenseCategory)?.label ?? "Tjera";
      const uploadedReceipt = expenseReceiptFile ? await uploadFileToStorage(expenseReceiptFile, "receipts") : null;

      const notes = buildNotes(expenseNotes, [
        ["Kupon", uploadedReceipt || null]
      ]);

      await createExpense({
        owner_id: data.car.owner_id,
        car_id: data.car.id,
        expense_date: expenseDate,
        category: categoryLabel,
        amount: Number(expenseAmount),
        notes,
        vendor: null
      });

      await refreshData();

      setExpenseDate(todayIso);
      setExpenseAmount("");
      setExpenseNotes("");
      setExpenseReceiptFile(null);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Ruajtja e shpenzimit dështoi.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditService = async (service: ServiceRecordRow) => {
    const nextType = window.prompt("Lloji i servisimit", service.service_type) ?? service.service_type;
    const nextDate = window.prompt("Data (YYYY-MM-DD)", service.service_date) ?? service.service_date;
    const nextNotes = window.prompt("Shënime", service.notes ?? "") ?? service.notes ?? "";

    setFormError("");

    try {
      await updateServiceRecord(service.id, {
        service_type: nextType.trim() || service.service_type,
        service_date: nextDate.trim() || service.service_date,
        notes: nextNotes.trim() || null
      });

      await refreshData();
    } catch (editError) {
      setFormError(editError instanceof Error ? editError.message : "Editimi i servisimit dështoi.");
    }
  };

  const handleDeleteService = async (service: ServiceRecordRow) => {
    const confirmed = window.confirm("A je i sigurt që don me fshi këtë servisim?");
    if (!confirmed) return;

    setFormError("");

    try {
      await deleteServiceRecord(service.id);
      await refreshData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Fshirja e servisimit dështoi.");
    }
  };

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
              { key: "expenses" as Tab, label: "Shpenzime", icon: "💰" },
              { key: "reports" as Tab, label: "Raporti", icon: "📈" }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "reports") {
                    setReportYear(String(currentYear));
                    setReportMonth(String(currentMonth));
                  }
                }}
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
                label="Planifikime / Reminder"
                value={nextService?.next_service_due_at ? formatDate(nextService.next_service_due_at) : "—"}
                sublabel={nextService?.service_type || "Servisi tjetër"}
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
                    <div className="rounded-xl border border-white/10 bg-deep/30 p-4 text-sm text-slate-400">
                      Nuk ka dokumente ende.
                    </div>
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
                    <div className="rounded-xl border border-white/10 bg-deep/30 p-4 text-sm text-slate-400">
                      Nuk ka servisime ende.
                    </div>
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
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDocumentFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  documentFilter === "all" ? "bg-mint/15 text-mint" : "bg-white/5 text-slate-300"
                }`}
              >
                Të gjitha ({documentFilterStats.all})
              </button>
              <button
                type="button"
                onClick={() => setDocumentFilter("expiring")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  documentFilter === "expiring" ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-slate-300"
                }`}
              >
                Po skadojnë ({documentFilterStats.expiring})
              </button>
              <button
                type="button"
                onClick={() => setDocumentFilter("expired")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  documentFilter === "expired" ? "bg-red-500/20 text-red-300" : "bg-white/5 text-slate-300"
                }`}
              >
                Skaduara ({documentFilterStats.expired})
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    Lloji i dokumentit
                    <select
                      value={documentType}
                      onChange={(event) => setDocumentType(event.target.value as DocumentKind)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                    >
                      {DOCUMENT_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {documentType !== "invoice" && documentType !== "inspection" && (
                    <label className="text-sm text-slate-300">
                      Titulli
                      <input
                        value={documentTitle}
                        onChange={(event) => setDocumentTitle(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        required
                      />
                    </label>
                  )}

                  {documentType === "registration" && (
                    <>
                      <label className="text-sm text-slate-300">
                        Data e regjistrimit
                        <input
                          type="text"
                          value={documentIssuedOn}
                          onChange={(event) => setDocumentIssuedOn(event.target.value)}
                          required
                          placeholder="dd/mm/yyyy"
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        />
                        <p className="mt-1 text-xs text-slate-400">Shkruaj formatin: ditë/muaj/vit (p.sh. 03/03/2026)</p>
                      </label>

                      <label className="text-sm text-slate-300">
                        Data e skadimit (+1 vit automatik)
                        <input
                          type="text"
                          value={formatIsoToDmy(addOneYear(documentIssuedOn))}
                          readOnly
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-slate-300"
                        />
                      </label>
                    </>
                  )}

                  {documentType === "insurance" && (
                    <label className="text-sm text-slate-300">
                      Data e sigurimit
                      <input
                        type="date"
                        value={documentIssuedOn}
                        onChange={(event) => setDocumentIssuedOn(event.target.value)}
                        required
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      />
                    </label>
                  )}

                  {documentType === "inspection" && (
                    <>
                      <label className="text-sm text-slate-300">
                        A u bë kontrolla teknike?
                        <select
                          value={inspectionCompleted}
                          onChange={(event) => setInspectionCompleted(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        >
                          <option value="po">Po</option>
                          <option value="jo">Jo</option>
                        </select>
                      </label>

                      <label className="text-sm text-slate-300">
                        Data e kontrollës teknike
                        <input
                          type="date"
                          value={documentIssuedOn}
                          onChange={(event) => setDocumentIssuedOn(event.target.value)}
                          required
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        />
                      </label>
                    </>
                  )}

                  {(documentType === "manual" || documentType === "authorization") && (
                    <>
                      <label className="text-sm text-slate-300">
                        Data e lëshimit
                        <input
                          type="date"
                          value={documentIssuedOn}
                          onChange={(event) => setDocumentIssuedOn(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        />
                      </label>

                      <label className="text-sm text-slate-300">
                        Data e skadimit (opsionale)
                        <input
                          type="date"
                          value={documentExpiresOn}
                          onChange={(event) => setDocumentExpiresOn(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        />
                      </label>
                    </>
                  )}
                </div>

                {(documentType === "insurance" || documentType === "inspection" || documentType === "invoice" || documentType === "manual" || documentType === "authorization") && (
                  <label className="block text-sm text-slate-300">
                    Koment / shënime
                    <textarea
                      value={documentNotes}
                      onChange={(event) => setDocumentNotes(event.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                    />
                  </label>
                )}

                {(documentType === "invoice" || documentType === "manual" || documentType === "authorization" || documentType === "registration" || documentType === "insurance") && (
                  <label className="block text-sm text-slate-300">
                    Upload file (PDF/foto)
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                      className="mt-1 block w-full text-sm text-slate-300"
                    />
                  </label>
                )}

                {formError && <p className="text-sm text-red-300">{formError}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-mint px-4 py-2 text-sm font-bold text-deep transition hover:bg-mint/90 disabled:opacity-60"
                >
                  {saving ? "Duke ruajtur..." : "Ruaj dokumentin"}
                </button>
              </form>

            {filteredDocuments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400">
                Nuk ka dokumente për këtë filtër.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDocuments.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Services tab */}
        {activeTab === "services" && (
          <div className="space-y-6">
            <h2 className="font-display text-xl font-bold">Historia e Servisimeve</h2>

            <form onSubmit={handleCreateService} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    Lloji i servisimit
                    <select
                      value={serviceType}
                      onChange={(event) => setServiceType(event.target.value as ServiceKind)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                    >
                      {SERVICE_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {serviceType === "other" && (
                    <label className="text-sm text-slate-300">
                      Lloj custom
                      <input
                        value={otherServiceCustomLabel}
                        onChange={(event) => setOtherServiceCustomLabel(event.target.value)}
                        required
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      />
                    </label>
                  )}

                  <label className="text-sm text-slate-300">
                    Data
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(event) => setServiceDate(event.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                    />
                  </label>

                  {(serviceType === "oil_change" || serviceType === "other") && (
                    <label className="text-sm text-slate-300">
                      KM në atë moment
                      <input
                        type="number"
                        min={0}
                        value={serviceMileage}
                        onChange={(event) => setServiceMileage(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      />
                    </label>
                  )}

                  {serviceType === "other" && (
                    <>
                      <label className="text-sm text-slate-300">
                        Punëtori / servisi (opsionale)
                        <input
                          value={serviceProvider}
                          onChange={(event) => setServiceProvider(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        />
                      </label>

                      <label className="text-sm text-slate-300">
                        Kosto (€) (opsionale)
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={serviceCost}
                          onChange={(event) => setServiceCost(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                        />
                      </label>
                    </>
                  )}
                </div>

                {serviceType === "oil_change" && (
                  <div className="grid gap-3 rounded-xl border border-white/10 bg-deep/40 p-4">
                    <div>
                      <p className="text-sm text-slate-300">Filtrat</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
                        <label><input type="checkbox" checked={oilFilter} onChange={(event) => setOilFilter(event.target.checked)} /> vaj</label>
                        <label><input type="checkbox" checked={airFilter} onChange={(event) => setAirFilter(event.target.checked)} /> ajër</label>
                        <label><input type="checkbox" checked={fuelFilter} onChange={(event) => setFuelFilter(event.target.checked)} /> naftë</label>
                        <label><input type="checkbox" checked={cabinFilter} onChange={(event) => setCabinFilter(event.target.checked)} /> kabinë</label>
                      </div>
                    </div>
                  </div>
                )}

                {serviceType === "tires" && (
                  <div className="grid gap-3 rounded-xl border border-white/10 bg-deep/40 p-4 md:grid-cols-2">
                    <label className="text-sm text-slate-300">
                      Sezoni
                      <select
                        value={tireSeason}
                        onChange={(event) => setTireSeason(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      >
                        <option value="verë">Verë</option>
                        <option value="dimër">Dimër</option>
                        <option value="all-season">All-season</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-300">
                      Balancim
                      <select
                        value={tireBalancing}
                        onChange={(event) => setTireBalancing(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      >
                        <option value="po">Po</option>
                        <option value="jo">Jo</option>
                      </select>
                    </label>
                  </div>
                )}

                {serviceType === "brakes" && (
                  <div className="grid gap-3 rounded-xl border border-white/10 bg-deep/40 p-4 md:grid-cols-3">
                    <label className="text-sm text-slate-300">
                      Para / mbrapa
                      <select
                        value={brakeAxle}
                        onChange={(event) => setBrakeAxle(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      >
                        <option value="para">Para</option>
                        <option value="mbrapa">Mbrapa</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-300">
                      Disqe
                      <select
                        value={brakeDiscs}
                        onChange={(event) => setBrakeDiscs(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      >
                        <option value="po">Po</option>
                        <option value="jo">Jo</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-300">
                      Pllaka
                      <select
                        value={brakePads}
                        onChange={(event) => setBrakePads(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      >
                        <option value="po">Po</option>
                        <option value="jo">Jo</option>
                      </select>
                    </label>
                  </div>
                )}

                {serviceType === "battery" && (
                  <div className="rounded-xl border border-white/10 bg-deep/40 p-4">
                    <label className="text-sm text-slate-300">
                      A është vendosur e re?
                      <select
                        value={batteryReplaced}
                        onChange={(event) => setBatteryReplaced(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      >
                        <option value="po">Po</option>
                        <option value="jo">Jo</option>
                      </select>
                    </label>
                  </div>
                )}

                {serviceType === "antifreeze" && (
                  <div className="rounded-xl border border-white/10 bg-deep/40 p-4">
                    <label className="text-sm text-slate-300">
                      Antifrizi në dimër
                      <select
                        value={antifreezeWinterLevel}
                        onChange={(event) => setAntifreezeWinterLevel(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      >
                        <option value="-20">-20</option>
                        <option value="-30">-30</option>
                        <option value="-40">-40</option>
                      </select>
                    </label>
                  </div>
                )}

                {serviceType === "other" && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-slate-300">
                      Ndërrim vajit pas X km (opsionale)
                      <input
                        type="number"
                        min={0}
                        value={serviceNextKm}
                        onChange={(event) => setServiceNextKm(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      />
                    </label>
                    <label className="text-sm text-slate-300">
                      Servisi tjetër në datë (opsionale)
                      <input
                        type="date"
                        value={serviceNextDate}
                        onChange={(event) => setServiceNextDate(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                      />
                    </label>
                  </div>
                )}

                <label className="block text-sm text-slate-300">
                  Shënime
                  <textarea
                    rows={3}
                    value={serviceNotes}
                    onChange={(event) => setServiceNotes(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                  />
                </label>

                {formError && <p className="text-sm text-red-300">{formError}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-mint px-4 py-2 text-sm font-bold text-deep transition hover:bg-mint/90 disabled:opacity-60"
                >
                  {saving ? "Duke ruajtur..." : "Ruaj servisimin"}
                </button>
              </form>

            {serviceRecords.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400">
                Nuk ka servisime ende.
              </div>
            ) : (
              <div className="space-y-4">
                {serviceRecords.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onEdit={handleEditService}
                    onDelete={handleDeleteService}
                  />
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
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    Data
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(event) => setExpenseDate(event.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Shuma (€)
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={expenseAmount}
                      onChange={(event) => setExpenseAmount(event.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Kategoria
                    <select
                      value={expenseCategory}
                      onChange={(event) => setExpenseCategory(event.target.value as ExpenseKind)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                    >
                      {EXPENSE_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-sm text-slate-300">
                  Shënime
                  <textarea
                    rows={3}
                    value={expenseNotes}
                    onChange={(event) => setExpenseNotes(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Foto e kuponit (opsionale)
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => setExpenseReceiptFile(event.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm text-slate-300"
                  />
                </label>

                {formError && <p className="text-sm text-red-300">{formError}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-mint px-4 py-2 text-sm font-bold text-deep transition hover:bg-mint/90 disabled:opacity-60"
                >
                  {saving ? "Duke ruajtur..." : "Ruaj shpenzimin"}
                </button>
              </form>

            {expenses.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400">
                Nuk ka shpenzime ende.
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <ExpenseCard key={expense.id} expense={expense} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <label className="text-sm text-slate-300">
                Viti
                <select
                  value={reportYear}
                  onChange={(event) => setReportYear(event.target.value)}
                  className="mt-1 w-40 rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                >
                  <option value="all">Të gjitha</option>
                  {availableReportYears.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-300">
                Muaji
                <select
                  value={reportMonth}
                  onChange={(event) => setReportMonth(event.target.value)}
                  className="mt-1 w-44 rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                >
                  <option value="all">Të gjitha</option>
                  {REPORT_MONTH_OPTIONS.map((monthLabel, index) => (
                    <option key={monthLabel} value={String(index + 1)}>
                      {monthLabel}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2 pb-0.5">
                <button
                  type="button"
                  onClick={() => setReportEventFilter("documents")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    reportEventFilter === "documents" ? "bg-mint/15 text-mint" : "bg-white/5 text-slate-300"
                  }`}
                >
                  Dokumente
                </button>
                <button
                  type="button"
                  onClick={() => setReportEventFilter("services")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    reportEventFilter === "services" ? "bg-mint/15 text-mint" : "bg-white/5 text-slate-300"
                  }`}
                >
                  Servisime
                </button>
                <button
                  type="button"
                  onClick={() => setReportEventFilter("expenses")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    reportEventFilter === "expenses" ? "bg-mint/15 text-mint" : "bg-white/5 text-slate-300"
                  }`}
                >
                  Shpenzime
                </button>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50">
              <div className="border-b border-white/10 px-4 py-3">
                <h3 className="font-display text-lg font-bold">Historia e plotë</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Lloji</th>
                      <th className="px-4 py-3">Përshkrimi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportHistoryRows.map((row) => (
                      <tr key={row.id} className="border-t border-white/5">
                        <td className="px-4 py-3 text-slate-300">{formatDate(row.date)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.source}</td>
                        <td className="px-4 py-3 text-white">{row.label}</td>
                      </tr>
                    ))}
                    {reportHistoryRows.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                          Nuk ka histori për filtrin aktual.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
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
  const reportStatus = getDocumentReportStatus(document.expires_on);

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
      <h4 className="mt-4 font-display text-lg font-bold">{document.reference_number || docType.label}</h4>
      <div className="mt-3 space-y-1 text-sm text-slate-400">
        <p>Lloji: {docType.label}</p>
        <p>Skadon: {formatDate(document.expires_on)}</p>
        <p>Statusi: {reportStatus === "expired" ? "Skaduar" : reportStatus === "expiring" ? "Po skadon" : "OK"}</p>
        {document.issuer && <p>Lëshuar nga: {document.issuer}</p>}
        {document.file_url && (
          <a href={document.file_url} target="_blank" rel="noreferrer" className="text-mint hover:underline">
            Hap skedarin
          </a>
        )}
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

function ServiceCard({
  service,
  onEdit,
  onDelete
}: {
  service: ServiceRecordRow;
  onEdit: (service: ServiceRecordRow) => void;
  onDelete: (service: ServiceRecordRow) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-display text-lg font-bold">{service.service_type}</h4>
          <p className="text-sm text-slate-400">{formatDate(service.service_date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(service)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Editoje
          </button>
          <button
            type="button"
            onClick={() => onDelete(service)}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
          >
            Fshije
          </button>
        </div>
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

export default VehicleDashboardPage;
