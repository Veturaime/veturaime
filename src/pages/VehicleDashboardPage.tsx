import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import type { DocumentRow, ExpenseRow, ServiceRecordRow } from "../lib/database.types";
import {
  createDocument,
  createExpense,
  createServiceRecord,
  deleteDocument,
  deleteExpense,
  deleteServiceRecord,
  getVehicleDashboardData,
  supabase,
  updateDocument,
  updateExpense,
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
import dashboardCarImage from "../../assets/hero-car.jpg";
import {
  ensureNonNegativeNumber,
  ensurePositiveAmount,
  ensureValidDateInput,
  validateVehicleUploadFile
} from "../lib/vehicle-dashboard-validation";

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
type ReportEventFilter = "all" | "documents" | "services" | "expenses";

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

// Document type labels
const DOCUMENT_TYPES: Record<string, { label: string }> = {
  registration: { label: "Regjistrimi" },
  insurance: { label: "Sigurimi" },
  inspection: { label: "Kontrolli Teknik" },
  authorization: { label: "Leja/Autorizim" },
  invoice: { label: "Faturë / Kupon" },
  manual: { label: "Manual / të tjera" },
  license: { label: "Leja/Autorizim" },
  tax: { label: "Faturë / Kupon" },
  warranty: { label: "Manual / të tjera" },
  other: { label: "Tjetër" }
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

const OIL_CHANGE_LABEL = SERVICE_KIND_OPTIONS.find((option) => option.value === "oil_change")?.label ?? "Ndërrim vaji + filtra";

function isOilChangeServiceType(serviceType: string) {
  return serviceType.trim().toLowerCase() === OIL_CHANGE_LABEL.toLowerCase();
}

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

function extractFirstUrl(value: string | null) {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s]+/i);
  return match?.[0] ?? null;
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

function getDateTimestamp(dateValue: string | null | undefined, fallback = 0) {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? fallback : timestamp;
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

function sanitizePdfFilePart(value: string) {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return clean || "vetura";
}

type Tab = "overview" | "documents" | "services" | "expenses" | "reports";

const VEHICLE_DASHBOARD_TABS: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Përmbledhje" },
  { key: "documents", label: "Dokumente" },
  { key: "services", label: "Servisime" },
  { key: "expenses", label: "Shpenzime" },
  { key: "reports", label: "Raporti" }
];

function getOverviewNotificationStorageKey(carId: string) {
  return `veturaime-overview-dismissed-${carId}`;
}

function loadDismissedOverviewNotifications(carId: string) {
  if (typeof window === "undefined") {
    return {} as Record<string, number>;
  }

  try {
    const rawValue = window.localStorage.getItem(getOverviewNotificationStorageKey(carId));
    if (!rawValue) {
      return {} as Record<string, number>;
    }

    const parsedValue = JSON.parse(rawValue) as Record<string, number>;
    const now = Date.now();

    return Object.fromEntries(
      Object.entries(parsedValue).filter(([, expiresAt]) => Number.isFinite(expiresAt) && expiresAt > now)
    );
  } catch {
    return {} as Record<string, number>;
  }
}

function saveDismissedOverviewNotifications(carId: string, entries: Record<string, number>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (Object.keys(entries).length === 0) {
      window.localStorage.removeItem(getOverviewNotificationStorageKey(carId));
      return;
    }

    window.localStorage.setItem(getOverviewNotificationStorageKey(carId), JSON.stringify(entries));
  } catch {
    // Ignore storage failures and continue with in-memory state.
  }
}

function VehicleDashboardPage() {
  const { carId, section } = useParams<{ carId: string; section?: string }>();
  const navigate = useNavigate();
  const now = new Date();
  const currentYear = now.getFullYear();
  const [data, setData] = useState<VehicleDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialTab = VEHICLE_DASHBOARD_TABS.some((tab) => tab.key === section) ? (section as Tab) : "overview";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
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

  const [reportYear, setReportYear] = useState<string>("all");
  const [reportMonth, setReportMonth] = useState<string>("all");
  const [reportEventFilter, setReportEventFilter] = useState<ReportEventFilter>("all");
  const [showReportMileage, setShowReportMileage] = useState(false);
  const [showOverviewNotificationsPanel, setShowOverviewNotificationsPanel] = useState(false);
  const [dismissedOverviewNotifications, setDismissedOverviewNotifications] = useState<Record<string, number>>({});
  const tabsNavRef = useRef<HTMLElement | null>(null);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  useEffect(() => {
    const nextTab = VEHICLE_DASHBOARD_TABS.some((tab) => tab.key === section) ? (section as Tab) : "overview";
    setActiveTab(nextTab);
  }, [section]);

  useEffect(() => {
    if (!carId) {
      setDismissedOverviewNotifications({});
      return;
    }

    const activeDismissals = loadDismissedOverviewNotifications(carId);
    setDismissedOverviewNotifications(activeDismissals);
    saveDismissedOverviewNotifications(carId, activeDismissals);
  }, [carId]);

  const getVehicleTabPath = (tab: Tab) => {
    if (!carId) {
      return "/my-garage";
    }

    return tab === "overview" ? `/vehicle/${carId}` : `/vehicle/${carId}/${tab}`;
  };

  const handleTabChange = (nextTab: Tab) => {
    if (activeTab === nextTab || saving) {
      return;
    }

    setActiveTab(nextTab);
    navigate(getVehicleTabPath(nextTab), { replace: true });
  };

  const updateTabsScrollState = () => {
    const nav = tabsNavRef.current;

    if (!nav) {
      setCanScrollTabsLeft(false);
      setCanScrollTabsRight(false);
      return;
    }

    const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth);
    setCanScrollTabsLeft(nav.scrollLeft > 4);
    setCanScrollTabsRight(maxScrollLeft - nav.scrollLeft > 4);
  };

  const scrollTabsBy = (direction: "left" | "right") => {
    const nav = tabsNavRef.current;

    if (!nav) {
      return;
    }

    const offset = Math.max(nav.clientWidth * 0.75, 120);
    nav.scrollBy({
      left: direction === "right" ? offset : -offset,
      behavior: "smooth"
    });
  };

  useEffect(() => {
    const nav = tabsNavRef.current;

    if (!nav) {
      return;
    }

    const handleTabsScroll = () => {
      updateTabsScrollState();
    };

    const handleTabsResize = () => {
      updateTabsScrollState();
    };

    updateTabsScrollState();
    nav.addEventListener("scroll", handleTabsScroll, { passive: true });
    window.addEventListener("resize", handleTabsResize);

    return () => {
      nav.removeEventListener("scroll", handleTabsScroll);
      window.removeEventListener("resize", handleTabsResize);
    };
  }, [activeTab]);

  useEffect(() => {
    const nav = tabsNavRef.current;

    if (!nav) {
      return;
    }

    const activeButton = nav.querySelector<HTMLButtonElement>(`button[data-tab="${activeTab}"]`);
    activeButton?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    updateTabsScrollState();
  }, [activeTab]);

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
        let resolvedImage: string | null =
          car.image_url && !isGeneratedVehiclePlaceholder(car.image_url) ? car.image_url : null;

        const fetchedImage = await fetchVehicleImage(
          car.make,
          car.model,
          car.year ?? undefined,
          car.body_type ?? undefined,
          car.color ?? undefined
        );

        if (fetchedImage && !isGeneratedVehiclePlaceholder(fetchedImage)) {
          resolvedImage = fetchedImage;

          if (fetchedImage !== car.image_url) {
            void updateCar(car.id, { image_url: fetchedImage }).catch(() => undefined);
          }
        }

        if (isMounted) {
          setCarImage(resolvedImage);
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
        return days !== null && days >= 0 && days <= 30;
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
    return data.serviceRecords.filter((s) => !s.deleted_at).reduce((sum, s) => sum + Number(s.cost), 0);
  }, [data]);

  const overviewNotifications = useMemo(() => {
    if (!data) return [];

    const documentAlerts = data.documents
      .map((document) => {
        const days = getDaysUntil(document.expires_on);
        if (days === null || days > 30) return null;

        return {
          id: `document-${document.id}`,
          kind: "documents" as const,
          title: DOCUMENT_TYPES[document.document_type]?.label ?? document.document_type,
          subtitle: `Skadon: ${formatDate(document.expires_on)}`,
          badge: days < 0 ? "Skaduar" : `${days} ditë`,
          dueDate: document.expires_on ?? document.created_at
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const serviceAlerts = data.serviceRecords
      .filter((service) => !service.deleted_at && Boolean(service.next_service_due_at))
      .map((service) => {
        const days = getDaysUntil(service.next_service_due_at);
        if (days === null || days > 30) return null;

        return {
          id: `service-${service.id}`,
          kind: "services" as const,
          title: service.service_type,
          subtitle: `Afati: ${formatDate(service.next_service_due_at)}`,
          badge: days < 0 ? "Kaluar" : days === 0 ? "Sot" : `${days} ditë`,
          dueDate: service.next_service_due_at ?? service.service_date
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return [...documentAlerts, ...serviceAlerts].sort(
      (left, right) => getDateTimestamp(left.dueDate) - getDateTimestamp(right.dueDate)
    );
  }, [data]);

  const visibleOverviewNotifications = useMemo(() => {
    const now = Date.now();

    return overviewNotifications.filter((notification) => {
      const hiddenUntil = dismissedOverviewNotifications[notification.id];
      return !hiddenUntil || hiddenUntil <= now;
    });
  }, [dismissedOverviewNotifications, overviewNotifications]);

  const overviewNotificationCount = visibleOverviewNotifications.length;

  const handleOverviewNotificationsClick = () => {
    if (overviewNotificationCount === 0 || saving) {
      return;
    }

    setShowOverviewNotificationsPanel((current) => !current);
  };

  const recentDocuments = useMemo(() => {
    if (!data) return [];

    return [...data.documents]
      .sort((left, right) => getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at))
      .slice(0, 1);
  }, [data]);

  const recentServices = useMemo(() => {
    if (!data) return [];

    return data.serviceRecords
      .filter((service) => !service.deleted_at)
      .sort((left, right) => getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at))
      .slice(0, 1);
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

    return data.documents
      .filter((document) => {
        const status = getDocumentReportStatus(document.expires_on);

        if (documentFilter === "expiring") return status === "expiring";
        if (documentFilter === "expired") return status === "expired";
        return true;
      })
      .sort((left, right) => {
        const leftExpiry = getDateTimestamp(left.expires_on, Number.POSITIVE_INFINITY);
        const rightExpiry = getDateTimestamp(right.expires_on, Number.POSITIVE_INFINITY);

        if (leftExpiry !== rightExpiry) {
          return leftExpiry - rightExpiry;
        }

        return getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at);
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

    return data.expenses
      .filter((expense) => {
        const year = getYear(expense.expense_date);
        const month = getMonth(expense.expense_date);
        const yearMatch = reportYear === "all" || year === Number(reportYear);
        const monthMatch = reportMonth === "all" || month === Number(reportMonth);
        return yearMatch && monthMatch;
      })
      .sort((left, right) => {
        const byDate = getDateTimestamp(right.expense_date) - getDateTimestamp(left.expense_date);
        if (byDate !== 0) return byDate;
        return getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at);
      });
  }, [data, reportMonth, reportYear]);

  const reportServices = useMemo(() => {
    if (!data) return [];

    return data.serviceRecords
      .filter((service) => {
        if (service.deleted_at) return false;
        const year = getYear(service.service_date);
        const month = getMonth(service.service_date);
        const yearMatch = reportYear === "all" || year === Number(reportYear);
        const monthMatch = reportMonth === "all" || month === Number(reportMonth);
        return yearMatch && monthMatch;
      })
      .sort((left, right) => {
        const byDate = getDateTimestamp(right.service_date) - getDateTimestamp(left.service_date);
        if (byDate !== 0) return byDate;
        return getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at);
      });
  }, [data, reportMonth, reportYear]);

  const reportDocuments = useMemo(() => {
    if (!data) return [];

    return data.documents
      .filter((document) => {
        const referenceDate = document.expires_on ?? document.issued_on;
        const year = getYear(referenceDate);
        const month = getMonth(referenceDate);
        const yearMatch = reportYear === "all" || year === Number(reportYear);
        const monthMatch = reportMonth === "all" || month === Number(reportMonth);
        return yearMatch && monthMatch;
      })
      .sort((left, right) => {
        const leftReferenceDate = left.expires_on ?? left.issued_on ?? left.created_at;
        const rightReferenceDate = right.expires_on ?? right.issued_on ?? right.created_at;
        const byDate = getDateTimestamp(rightReferenceDate) - getDateTimestamp(leftReferenceDate);
        if (byDate !== 0) return byDate;
        return getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at);
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
      .filter((row) => reportEventFilter === "all" || row.kind === reportEventFilter)
      .sort(
      (left, right) => getDateTimestamp(right.date) - getDateTimestamp(left.date)
    );
  }, [reportDocuments, reportEventFilter, reportExpenses, reportServices]);

  const latestReportRows = useMemo(() => {
    if (reportEventFilter !== "all") {
      return [];
    }

    return reportHistoryRows.slice(0, 3);
  }, [reportEventFilter, reportHistoryRows]);

  const hasAnyReportData = reportDocuments.length > 0 || reportServices.length > 0 || reportExpenses.length > 0;

  const downloadReportPdf = (type: "all" | "documents" | "services" | "expenses") => {
    if (!data) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 36;
    const topY = 36;
    const bottomY = pageHeight - 38;
    const contentWidth = pageWidth - marginX * 2;
    const rowLineHeight = 11;
    const textPaddingX = 6;
    let currentY = topY;

    const colors = {
      pageBg: [248, 250, 252] as const,
      headerBg: [15, 23, 42] as const,
      accent: [16, 185, 129] as const,
      title: [17, 24, 39] as const,
      body: [51, 65, 85] as const,
      soft: [241, 245, 249] as const,
      line: [226, 232, 240] as const,
      white: [255, 255, 255] as const
    };

    const drawPageBackground = () => {
      doc.setFillColor(...colors.pageBg);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
    };

    const ensureSpace = (neededHeight: number) => {
      if (currentY + neededHeight > bottomY) {
        doc.addPage();
        drawPageBackground();
        currentY = topY;
      }
    };

    const drawTextBlock = (
      text: string,
      x: number,
      y: number,
      width: number,
      options?: { size?: number; bold?: boolean; color?: readonly [number, number, number] }
    ) => {
      const size = options?.size ?? 10;
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      doc.setFontSize(size);
      if (options?.color) {
        doc.setTextColor(...options.color);
      } else {
        doc.setTextColor(...colors.body);
      }

      const lines = doc.splitTextToSize(text || "-", width) as string[];
      doc.text(lines, x, y);
      return lines.length;
    };

    const drawSectionHeader = (title: string, count: number) => {
      ensureSpace(30);
      doc.setFillColor(...colors.soft);
      doc.roundedRect(marginX, currentY, contentWidth, 24, 5, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...colors.title);
      doc.text(title, marginX + 10, currentY + 15);

      const badge = `${count} rreshta`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const badgeWidth = doc.getTextWidth(badge) + 12;
      const badgeX = marginX + contentWidth - badgeWidth - 8;
      doc.setFillColor(...colors.white);
      doc.roundedRect(badgeX, currentY + 5, badgeWidth, 14, 4, 4, "F");
      doc.setTextColor(...colors.body);
      doc.text(badge, badgeX + 6, currentY + 15);
      currentY += 34;
    };

    const drawTable = (headers: string[], rows: string[][], colWidths: number[]) => {
      if (rows.length === 0) {
        ensureSpace(26);
        doc.setDrawColor(...colors.line);
        doc.setFillColor(...colors.white);
        doc.roundedRect(marginX, currentY, contentWidth, 24, 4, 4, "FD");
        drawTextBlock("Nuk ka të dhëna për filtrin aktual.", marginX + 10, currentY + 15, contentWidth - 20, {
          size: 9,
          color: colors.body
        });
        currentY += 30;
        return;
      }

      const headerHeight = 22;
      ensureSpace(headerHeight + 8);
      doc.setFillColor(...colors.headerBg);
      doc.roundedRect(marginX, currentY, contentWidth, headerHeight, 4, 4, "F");

      let headerX = marginX;
      headers.forEach((header, index) => {
        const cellWidth = colWidths[index];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...colors.white);
        doc.text(header, headerX + textPaddingX, currentY + 14);
        headerX += cellWidth;
      });

      currentY += headerHeight;

      rows.forEach((row, rowIndex) => {
        let maxLines = 1;
        row.forEach((cell, index) => {
          const lines = doc.splitTextToSize(cell || "-", colWidths[index] - textPaddingX * 2) as string[];
          if (lines.length > maxLines) {
            maxLines = lines.length;
          }
        });

        const rowHeight = Math.max(22, maxLines * rowLineHeight + 8);
        ensureSpace(rowHeight + 2);

        doc.setDrawColor(...colors.line);
        const rowFill = rowIndex % 2 === 0 ? colors.white : colors.soft;
        doc.setFillColor(rowFill[0], rowFill[1], rowFill[2]);
        doc.rect(marginX, currentY, contentWidth, rowHeight, "FD");

        let cellX = marginX;
        row.forEach((cell, index) => {
          const cellWidth = colWidths[index];
          if (index > 0) {
            doc.line(cellX, currentY, cellX, currentY + rowHeight);
          }

          drawTextBlock(cell || "-", cellX + textPaddingX, currentY + 14, cellWidth - textPaddingX * 2, {
            size: 9,
            color: colors.body
          });
          cellX += cellWidth;
        });

        currentY += rowHeight;
      });

      currentY += 8;
    };

    const reportYearLabel = reportYear === "all" ? "Të gjitha" : reportYear;
    const reportMonthLabel = reportMonth === "all" ? "Të gjithë muajt" : REPORT_MONTH_OPTIONS[Number(reportMonth) - 1] ?? "Të gjitha";
    const carLabel = [data.car.nickname, data.car.make, data.car.model].filter(Boolean).join(" - ") || "Vetura";

    drawPageBackground();

    doc.setFillColor(...colors.headerBg);
    doc.roundedRect(marginX, currentY, contentWidth, 76, 8, 8, "F");
    doc.setFillColor(...colors.accent);
    doc.rect(marginX, currentY + 70, contentWidth, 6, "F");

    drawTextBlock("Raporti i Veturës", marginX + 14, currentY + 24, contentWidth - 28, {
      size: 16,
      bold: true,
      color: colors.white
    });
    drawTextBlock(carLabel, marginX + 14, currentY + 42, contentWidth - 28, {
      size: 11,
      bold: true,
      color: colors.white
    });
    drawTextBlock(`Filtri: Viti ${reportYearLabel} • Muaji ${reportMonthLabel}`, marginX + 14, currentY + 58, contentWidth - 28, {
      size: 9,
      color: colors.white
    });

    currentY += 92;

    const totalDocuments = reportDocuments.length;
    const totalServiceAmount = reportServices.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
    const totalExpenseAmount = reportExpenses.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

    ensureSpace(48);
    const cardGap = 10;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    const metricCards = [
      { title: "Dokumente", value: String(totalDocuments), note: "Rreshta në raport" },
      { title: "Servisime", value: formatCurrency(totalServiceAmount), note: `${reportServices.length} rreshta` },
      { title: "Shpenzime", value: formatCurrency(totalExpenseAmount), note: `${reportExpenses.length} rreshta` }
    ];

    metricCards.forEach((card, index) => {
      const cardX = marginX + index * (cardWidth + cardGap);
      doc.setFillColor(...colors.white);
      doc.setDrawColor(...colors.line);
      doc.roundedRect(cardX, currentY, cardWidth, 44, 6, 6, "FD");
      drawTextBlock(card.title, cardX + 8, currentY + 13, cardWidth - 16, { size: 8, color: colors.body });
      drawTextBlock(card.value, cardX + 8, currentY + 27, cardWidth - 16, { size: 11, bold: true, color: colors.title });
      drawTextBlock(card.note, cardX + 8, currentY + 38, cardWidth - 16, { size: 7, color: colors.body });
    });

    currentY += 56;

    if (type === "documents" || type === "all") {
      drawSectionHeader("Dokumente", reportDocuments.length);
      drawTable(
        ["Lloji", "Ref", "Lëshuar", "Skadon", "Statusi"],
        reportDocuments.map((row) => {
          const status = getDocumentReportStatus(row.expires_on);
          return [
            DOCUMENT_TYPES[row.document_type]?.label ?? row.document_type,
            row.reference_number ?? "-",
            formatDate(row.issued_on),
            formatDate(row.expires_on),
            status === "expired" ? "Skaduar" : status === "expiring" ? "Po skadon" : "OK"
          ];
        }),
        [contentWidth * 0.28, contentWidth * 0.18, contentWidth * 0.18, contentWidth * 0.18, contentWidth * 0.18]
      );
    }

    if (type === "services" || type === "all") {
      drawSectionHeader("Servisime", reportServices.length);
      drawTable(
        ["Servisimi", "Data", "Kosto", "KM", "Ofruesi"],
        reportServices.map((row) => [
          row.service_type,
          formatDate(row.service_date),
          formatCurrency(Number(row.cost ?? 0)),
          typeof row.mileage === "number" ? `${row.mileage.toLocaleString("sq-AL")} km` : "-",
          row.provider ?? "-"
        ]),
        [contentWidth * 0.34, contentWidth * 0.16, contentWidth * 0.16, contentWidth * 0.14, contentWidth * 0.2]
      );
    }

    if (type === "expenses" || type === "all") {
      drawSectionHeader("Shpenzime", reportExpenses.length);
      drawTable(
        ["Kategoria", "Data", "Shuma", "Furnitori", "Shënime"],
        reportExpenses.map((row) => [
          row.category,
          formatDate(row.expense_date),
          formatCurrency(Number(row.amount ?? 0)),
          row.vendor ?? "-",
          row.notes ?? "-"
        ]),
        [contentWidth * 0.2, contentWidth * 0.16, contentWidth * 0.16, contentWidth * 0.18, contentWidth * 0.3]
      );
    }

    const pageCount = doc.getNumberOfPages();
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      doc.setPage(pageIndex);
      doc.setDrawColor(...colors.line);
      doc.line(marginX, pageHeight - 26, pageWidth - marginX, pageHeight - 26);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...colors.body);
      doc.text(
        `Gjeneruar më ${formatDate(new Date().toISOString())} • Faqja ${pageIndex}/${pageCount}`,
        marginX,
        pageHeight - 14
      );
    }

    const monthFilePart = reportMonth === "all" ? "te-gjithe-muajt" : sanitizePdfFilePart(reportMonthLabel);
    const yearFilePart = reportYear === "all" ? "te-gjitha-vitet" : sanitizePdfFilePart(reportYearLabel);
    const carFilePart = sanitizePdfFilePart(carLabel);
    const typeFilePart = type === "all" ? "komplet" : type === "documents" ? "dokumente" : type === "services" ? "servisime" : "shpenzime";

    doc.save(`raport-${typeFilePart}-${carFilePart}-${yearFilePart}-${monthFilePart}.pdf`);
  };

  useEffect(() => {
    const option = DOCUMENT_KIND_OPTIONS.find((item) => item.value === documentType);
    if (option) {
      setDocumentTitle(option.label);
    }
  }, [documentType]);

  useEffect(() => {
    if (documentType === "registration") {
      return;
    }

    const normalized = normalizeDateInput(documentIssuedOn);

    if (!normalized) {
      setDocumentIssuedOn(todayIso);
      return;
    }

    if (normalized !== documentIssuedOn) {
      setDocumentIssuedOn(normalized);
    }
  }, [documentIssuedOn, documentType]);

  useEffect(() => {
    if (reportMonth === "all") {
      return;
    }

    const month = Number(reportMonth);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      setReportMonth("all");
    }
  }, [reportMonth]);

  useEffect(() => {
    if (reportYear === "all") {
      return;
    }

    const year = Number(reportYear);
    if (!Number.isInteger(year) || !availableReportYears.includes(year)) {
      setReportYear("all");
    }
  }, [availableReportYears, reportYear]);

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
      if (documentFile) {
        validateVehicleUploadFile(documentFile, "Dokumenti");
      }

      const uploadedFileUrl = documentFile ? await uploadFileToStorage(documentFile, "documents") : null;
      const normalizedIssuedDate = normalizeDateInput(documentIssuedOn);
      const normalizedExpiryDate = normalizeDateInput(documentExpiresOn);
      const registrationExpiry = addOneYear(normalizedIssuedDate);
      const requiresIssuedDate = ["registration", "insurance", "inspection", "manual", "authorization"].includes(documentType);

      if (requiresIssuedDate && !normalizedIssuedDate) {
        throw new Error("Data nuk është valide. Përdor formatin dd/mm/yyyy ose yyyy-mm-dd.");
      }

      if (["manual", "authorization"].includes(documentType) && documentExpiresOn.trim() && !normalizedExpiryDate) {
        throw new Error("Data e skadimit nuk është valide. Përdor formatin dd/mm/yyyy ose yyyy-mm-dd.");
      }

      if (documentType === "registration" && !registrationExpiry) {
        throw new Error("Data e skadimit nuk u llogarit. Kontrollo datën e regjistrimit.");
      }

      if (
        (documentType === "manual" || documentType === "authorization") &&
        normalizedIssuedDate &&
        normalizedExpiryDate &&
        getDateTimestamp(normalizedExpiryDate) < getDateTimestamp(normalizedIssuedDate)
      ) {
        throw new Error("Data e skadimit nuk mund të jetë më e hershme se data e lëshimit.");
      }

      const issuedOn =
        documentType === "registration" || documentType === "insurance" || documentType === "inspection" || documentType === "manual" || documentType === "authorization"
          ? normalizedIssuedDate || null
          : null;

      const expiresOn =
        documentType === "registration"
          ? registrationExpiry || null
          : documentType === "manual" || documentType === "authorization"
            ? normalizedExpiryDate || null
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
      ensureValidDateInput(serviceDate, "Data e servisimit nuk është valide.");

      const selectedServiceLabel = SERVICE_KIND_OPTIONS.find((option) => option.value === serviceType)?.label ?? "Servis";
      const serviceLabel = serviceType === "other" ? otherServiceCustomLabel.trim() || "Tjera" : selectedServiceLabel;

      if (serviceType === "oil_change" && !serviceMileage.trim()) {
        throw new Error("Shkruaje kilometrazhin aktual për këtë servis.");
      }

      const normalizedServiceCost = serviceCost.trim() ? Number(serviceCost) : 0;

      if (serviceType === "other" && (!Number.isFinite(normalizedServiceCost) || normalizedServiceCost < 0)) {
        throw new Error("Kostoja e servisimit duhet të jetë numër valid (0 ose më shumë).");
      }

      if (serviceType === "other" && serviceCost.trim()) {
        ensureNonNegativeNumber(serviceCost, "Kostoja e servisimit duhet të jetë numër valid (0 ose më shumë).");
      }

      const normalizedServiceMileage = serviceType === "oil_change" && serviceMileage.trim() ? Number(serviceMileage) : null;

      if (normalizedServiceMileage !== null) {
        if (!Number.isFinite(normalizedServiceMileage) || normalizedServiceMileage < 0) {
          throw new Error("Kilometrazhi i servisimit duhet të jetë numër valid.");
        }

        if (typeof data.car.mileage === "number" && normalizedServiceMileage < data.car.mileage) {
          throw new Error(
            `Kilometrazhi i servisimit nuk mund të jetë më i vogël se kilometrazhi i regjistrimit (${data.car.mileage.toLocaleString("sq-AL")} km).`
          );
        }
      }

      if (serviceType === "other" && serviceNextKm.trim()) {
        ensureNonNegativeNumber(serviceNextKm, "Plani i kilometrazhit duhet të jetë numër valid.");
      }

      if (serviceType === "other" && serviceNextDate.trim()) {
        ensureValidDateInput(serviceNextDate, "Data e servisimit të ardhshëm nuk është valide.");
      }

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
        cost: serviceType === "other" ? normalizedServiceCost : 0,
        mileage: normalizedServiceMileage,
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
      ensureValidDateInput(expenseDate, "Data e shpenzimit nuk është valide.");

      if (expenseReceiptFile) {
        validateVehicleUploadFile(expenseReceiptFile, "Kuponi");
      }

      const categoryLabel = EXPENSE_KIND_OPTIONS.find((option) => option.value === expenseCategory)?.label ?? "Tjera";
      const uploadedReceipt = expenseReceiptFile ? await uploadFileToStorage(expenseReceiptFile, "receipts") : null;
      const amountValue = ensurePositiveAmount(expenseAmount);

      const notes = buildNotes(expenseNotes, [
        ["Kupon", uploadedReceipt || null]
      ]);

      await createExpense({
        owner_id: data.car.owner_id,
        car_id: data.car.id,
        expense_date: expenseDate,
        category: categoryLabel,
        amount: amountValue,
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
      const normalizedDate = normalizeDateInput(nextDate.trim());
      if (!normalizedDate) {
        throw new Error("Data e servisimit nuk është valide.");
      }

      await updateServiceRecord(service.id, {
        service_type: nextType.trim() || service.service_type,
        service_date: normalizedDate,
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

  const handleEditDocument = async (document: DocumentRow) => {
    const nextTitle = window.prompt("Titulli / referenca", document.reference_number ?? "") ?? document.reference_number ?? "";
    const nextExpiry = window.prompt("Data e skadimit (YYYY-MM-DD)", document.expires_on ?? "") ?? document.expires_on ?? "";
    const nextNotes = window.prompt("Shënime", document.notes ?? "") ?? document.notes ?? "";

    setFormError("");

    try {
      const normalizedExpiryInput = nextExpiry.trim();
      const normalizedExpiry = normalizedExpiryInput ? normalizeDateInput(normalizedExpiryInput) : null;

      if (normalizedExpiryInput && !normalizedExpiry) {
        throw new Error("Data e skadimit nuk është valide.");
      }

      await updateDocument(document.id, {
        reference_number: nextTitle.trim() || null,
        expires_on: normalizedExpiry,
        notes: nextNotes.trim() || null,
        status: getDocumentReportStatus(normalizedExpiry) === "expired" ? "expired" : "active"
      });

      await refreshData();
    } catch (editError) {
      setFormError(editError instanceof Error ? editError.message : "Editimi i dokumentit dështoi.");
    }
  };

  const handleDeleteDocument = async (document: DocumentRow) => {
    const confirmed = window.confirm("A je i sigurt që don me fshi këtë dokument?");
    if (!confirmed) return;

    setFormError("");

    try {
      await deleteDocument(document.id);
      await refreshData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Fshirja e dokumentit dështoi.");
    }
  };

  const handleEditExpense = async (expense: ExpenseRow) => {
    const nextDate = window.prompt("Data (YYYY-MM-DD)", expense.expense_date) ?? expense.expense_date;
    const nextCategory = window.prompt("Kategoria", expense.category) ?? expense.category;
    const nextAmount = window.prompt("Shuma", String(expense.amount)) ?? String(expense.amount);
    const nextNotes = window.prompt("Shënime", expense.notes ?? "") ?? expense.notes ?? "";

    setFormError("");

    try {
      const amountValue = Number(nextAmount);
      const normalizedDate = normalizeDateInput(nextDate.trim());

      if (!normalizedDate) {
        throw new Error("Data e shpenzimit nuk është valide.");
      }

      if (!Number.isFinite(amountValue) || amountValue < 0) {
        throw new Error("Shuma nuk është valide.");
      }

      await updateExpense(expense.id, {
        expense_date: normalizedDate,
        category: nextCategory.trim() || expense.category,
        amount: amountValue,
        notes: nextNotes.trim() || null
      });

      await refreshData();
    } catch (editError) {
      setFormError(editError instanceof Error ? editError.message : "Editimi i shpenzimit dështoi.");
    }
  };

  const handleDeleteExpense = async (expense: ExpenseRow) => {
    const confirmed = window.confirm("A je i sigurt që don me fshi këtë shpenzim?");
    if (!confirmed) return;

    setFormError("");

    try {
      await deleteExpense(expense.id);
      await refreshData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Fshirja e shpenzimit dështoi.");
    }
  };

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
        <div className="text-center">
          <p className="text-lg text-[#b42318]">{error || "Vetura nuk u gjet."}</p>
          <Link
            to="/my-garage"
            className="mt-4 inline-flex items-center gap-2 text-[#2D3A3A] hover:underline"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 19l-7-7 7-7" />
            </svg>
            Kthehu te garazhi
          </Link>
        </div>
      </main>
    );
  }

  const { car, documents, serviceRecords, expenses } = data;
  const activeServiceRecords = serviceRecords.filter((service) => !service.deleted_at);
  const mileageServiceRows = activeServiceRecords
    .filter((service) => isOilChangeServiceType(service.service_type) && typeof service.mileage === "number")
    .sort((left, right) => {
      const byServiceDate = getDateTimestamp(right.service_date) - getDateTimestamp(left.service_date);
      if (byServiceDate !== 0) return byServiceDate;
      return getDateTimestamp(right.created_at) - getDateTimestamp(left.created_at);
    });
  const latestServiceWithMileage = mileageServiceRows[0] ?? null;
  const registrationMileage = car.mileage;
  const currentMileage = latestServiceWithMileage?.mileage ?? (typeof car.mileage === "number" ? car.mileage : null);
  const mileageDifference =
    typeof registrationMileage === "number" && typeof currentMileage === "number"
      ? currentMileage - registrationMileage
      : null;
  const mileageTimelineRows = [
    ...(typeof registrationMileage === "number"
      ? [
          {
            id: "registration",
            date: car.created_at,
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
  const colorInfo = COLORS.find((c) => c.value === car.color);
  const bodyTypeInfo = BODY_TYPES.find((b) => b.value === car.body_type);
  const fuelTypeInfo = FUEL_TYPES.find((f) => f.value === car.fuel_type);
  const transmissionInfo = TRANSMISSION_TYPES.find((t) => t.value === car.transmission);
  const renderableCarImage = getRenderableVehicleImageUrl(carImage);
  const dashboardHeroImage = renderableCarImage ?? carImage ?? dashboardCarImage;

  return (
    <main className="vehicle-dashboard-soft relative min-h-screen overflow-hidden bg-[#F9FAFB] font-body text-[#1F2937] antialiased">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-6 h-80 w-80 rounded-full bg-[#b8c8c5]/20 blur-3xl" />
        <div className="absolute -right-24 top-28 h-96 w-96 rounded-full bg-[#c8d8eb]/20 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/3 h-[420px] w-[420px] rounded-full bg-[#2D3A3A]/[0.04] blur-3xl" />
      </div>

      {/* Header with car hero */}
      <header className="relative overflow-hidden border-b border-[#e6eaee] bg-[#F9FAFB]/90 backdrop-blur-xl">
        {/* Background image */}
        <div className="absolute inset-0 opacity-[0.12]">
          <img src={dashboardHeroImage} alt="" className="h-full w-full object-cover blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(249,250,251,0.85),rgba(249,250,251,0.98))]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-8">
          {/* Breadcrumb */}
          <Link
            to="/my-garage"
            className="inline-flex items-center gap-2 text-sm text-[#6B7280] transition hover:text-[#1F2937]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 19l-7-7 7-7" />
            </svg>
            Garazhi im
          </Link>

          {/* Car title */}
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-5">
              {/* Car thumbnail */}
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#ffffff,#f3f7fb)] shadow-[0px_10px_30px_rgba(0,0,0,0.05)] sm:h-24 sm:w-36">
                <img
                  src={dashboardHeroImage}
                  alt={`${car.make} ${car.model}`}
                  className="h-full w-full object-contain p-3 drop-shadow-[0px_14px_22px_rgba(0,0,0,0.14)]"
                />
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827] md:text-3xl">
                    {car.make} {car.model}
                  </h1>
                  {colorInfo && (
                    <div
                      className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.8),0px_2px_8px_rgba(0,0,0,0.18)]"
                      style={{ backgroundColor: colorInfo.hex }}
                      title={colorInfo.label}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#6B7280]">
                  {car.year && <span>{car.year}</span>}
                  {bodyTypeInfo && (
                    <>
                      <span className="text-[#c7ced6]">•</span>
                      <span>{bodyTypeInfo.label}</span>
                    </>
                  )}
                  {fuelTypeInfo && (
                    <>
                      <span className="text-[#c7ced6]">•</span>
                      <span>{fuelTypeInfo.label}</span>
                    </>
                  )}
                  {transmissionInfo && (
                    <>
                      <span className="text-[#c7ced6]">•</span>
                      <span>{transmissionInfo.label}</span>
                    </>
                  )}
                </div>
                {car.license_plate && (
                  <div className="mt-2 inline-flex rounded-lg bg-[#f5f7fa] px-3 py-1 font-mono text-sm text-[#374151] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                    {car.license_plate}
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {typeof currentMileage === "number" && (
                <button
                  type="button"
                  onClick={() => navigate(`/vehicle/${car.id}/mileage-view`)}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-center shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0px_16px_38px_rgba(0,0,0,0.08)] sm:w-auto sm:px-5 sm:py-4"
                >
                  <p className="text-2xl font-bold text-[#111827]">{currentMileage.toLocaleString("sq-AL")}</p>
                  <p className="text-xs text-[#6B7280]">km</p>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(`/vehicle/${car.id}/documents-view`)}
                className="w-full rounded-2xl bg-white px-4 py-3 text-center shadow-[0px_10px_30px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0px_16px_38px_rgba(0,0,0,0.08)] sm:w-auto sm:px-5 sm:py-4"
              >
                <p className="text-2xl font-bold text-[#2D3A3A]">{documents.length}</p>
                <p className="text-xs text-[#6B7280]">dokumente</p>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-8 flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTabsBy("left")}
              disabled={saving || !canScrollTabsLeft}
              aria-label="Leviz tab-et majtas"
              title="Leviz majtas"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d6dee6] bg-white text-[#4b5563] shadow-[0px_8px_20px_rgba(0,0,0,0.06)] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40 md:hidden"
            >
              <span aria-hidden="true">{"<"}</span>
            </button>

            <nav ref={tabsNavRef} className="flex flex-1 gap-1 overflow-x-auto">
              {VEHICLE_DASHBOARD_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  data-tab={tab.key}
                  onClick={() => {
                    handleTabChange(tab.key);
                  }}
                  disabled={saving}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-[#e7f1ee] text-[#2D3A3A] shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                      : "text-[#6B7280] hover:bg-white hover:text-[#1F2937]"
                  } ${saving ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => scrollTabsBy("right")}
              disabled={saving || !canScrollTabsRight}
              aria-label="Leviz tab-et djathtas"
              title="Leviz djathtas"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d6dee6] bg-white text-[#4b5563] shadow-[0px_8px_20px_rgba(0,0,0,0.06)] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40 md:hidden"
            >
              <span aria-hidden="true">{">"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Stats grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Dokumente"
                value={String(documents.length)}
                sublabel={`${urgentDocuments.length} po skadon`}
                color={urgentDocuments.length > 0 ? "amber" : "mint"}
                onClick={documents.length > 0 ? () => handleTabChange("documents") : undefined}
              />
              <StatCard
                label="Servisime"
                value={String(activeServiceRecords.length)}
                sublabel={totalServices > 0 ? formatCurrency(totalServices) : ""}
                color="blue"
              />
              <StatCard
                label="Shpenzime"
                value={formatCurrency(totalExpenses)}
                sublabel={`${expenses.length} transaksione`}
                color="purple"
              />
              <StatCard
                label="Njoftime"
                value={String(overviewNotificationCount)}
                sublabel={overviewNotificationCount > 0 ? "Njoftime aktive" : "Nuk ka njoftime"}
                color="slate"
                onClick={overviewNotificationCount > 0 ? handleOverviewNotificationsClick : undefined}
              />
            </div>

            {showOverviewNotificationsPanel && overviewNotificationCount > 0 && (
              <section className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-[0px_18px_45px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f1ee] text-[#2D3A3A]">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.7}
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#1F2937]">Njoftimet</h3>
                      <p className="text-sm text-[#c2410c]">
                        {overviewNotificationCount} dokument{overviewNotificationCount > 1 ? "e" : ""} po skadon së shpejti
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOverviewNotificationsPanel(false)}
                    className="rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-sm font-semibold text-[#4b5563] transition hover:bg-[#e5e7eb]"
                  >
                    Mbylle
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {visibleOverviewNotifications.map((notification) => (
                    <article
                      key={notification.id}
                      className="flex items-center justify-between rounded-xl bg-white p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]"
                    >
                      <div>
                        <p className="font-semibold text-[#1F2937]">{notification.title}</p>
                        <p className="text-xs text-[#6B7280]">{notification.subtitle}</p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          notification.kind === "documents"
                            ? "bg-[#fef3c7] text-[#b45309]"
                            : "bg-[#dbeafe] text-[#1d4ed8]"
                        }`}
                      >
                        {notification.badge}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Recent activity */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent documents */}
              <section className="dashboard-panel rounded-3xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-[#1F2937]">Dokumentet</h3>
                  <button
                    type="button"
                    onClick={() => handleTabChange("documents")}
                    className="text-sm font-semibold text-[#2D3A3A] hover:underline"
                  >
                    Shiko të gjitha
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {recentDocuments.map((doc) => (
                    <DocumentRow key={doc.id} document={doc} />
                  ))}
                  {documents.length === 0 && (
                    <div className="dashboard-empty-state rounded-xl p-4 text-sm">
                      Nuk ka dokumente ende.
                    </div>
                  )}
                </div>
              </section>

              {/* Recent services */}
              <section className="dashboard-panel rounded-3xl p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-[#1F2937]">Servisimet e Fundit</h3>
                  <button
                    type="button"
                    onClick={() => handleTabChange("services")}
                    className="text-sm font-semibold text-[#2D3A3A] hover:underline"
                  >
                    Shiko të gjitha
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {recentServices.map((service) => (
                    <ServiceRow key={service.id} service={service} />
                  ))}
                  {activeServiceRecords.length === 0 && (
                    <div className="dashboard-empty-state rounded-xl p-4 text-sm">
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

            <form onSubmit={handleCreateDocument} className="dashboard-panel space-y-4 rounded-2xl p-5">
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
                          value={normalizeDateInput(documentIssuedOn) ? formatIsoToDmy(documentIssuedOn) : documentIssuedOn}
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

                <label className="block text-sm text-slate-300">
                  Upload file (PDF/foto)
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm text-slate-300"
                  />
                  {documentFile && <span className="mt-1 block text-xs text-slate-400">Zgjedhur: {documentFile.name}</span>}
                </label>

                {formError && <p className="text-sm text-red-300">{formError}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-mint px-4 py-2 text-sm font-bold text-deep transition hover:bg-mint/90 disabled:opacity-60"
                >
                  {saving ? "Duke ruajtur..." : "Ruaj dokumentin"}
                </button>
              </form>

            <section className="dashboard-panel space-y-4 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-white">Lista dhe filtrimi i dokumenteve</h3>
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
              </div>

              {filteredDocuments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-deep/30 p-6 text-sm text-slate-400">
                  Nuk ka dokumente për këtë filtër.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredDocuments.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onEdit={handleEditDocument}
                      onDelete={handleDeleteDocument}
                      showActions
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Services tab */}
        {activeTab === "services" && (
          <div className="space-y-6">
            <h2 className="font-display text-xl font-bold">Historia e Servisimeve</h2>

            <form onSubmit={handleCreateService} className="dashboard-panel space-y-4 rounded-2xl p-5">
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

                  {serviceType === "oil_change" && (
                    <label className="text-sm text-slate-300">
                      KM në atë moment
                      <input
                        type="number"
                        min={Math.max(0, registrationMileage ?? 0)}
                        value={serviceMileage}
                        onChange={(event) => setServiceMileage(event.target.value)}
                        required
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

            {activeServiceRecords.length === 0 ? (
              <div className="dashboard-empty-state rounded-2xl p-6 text-sm">
                Nuk ka servisime ende.
              </div>
            ) : (
              <div className="space-y-4">
                {activeServiceRecords.map((service) => (
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

            <form onSubmit={handleCreateExpense} className="dashboard-panel space-y-4 rounded-2xl p-5">
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
              <div className="dashboard-empty-state rounded-2xl p-6 text-sm">
                Nuk ka shpenzime ende.
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    onEdit={handleEditExpense}
                    onDelete={handleDeleteExpense}
                    showActions
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="dashboard-panel flex flex-wrap items-end gap-3 rounded-2xl p-4">
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

              <label className="text-sm text-slate-300">
                Lloji
                <select
                  value={reportEventFilter}
                  onChange={(event) => setReportEventFilter(event.target.value as ReportEventFilter)}
                  className="mt-1 w-44 rounded-xl border border-white/10 bg-deep px-3 py-2 text-white"
                >
                  <option value="all">Të gjitha</option>
                  <option value="documents">Dokumente</option>
                  <option value="services">Servisime</option>
                  <option value="expenses">Shpenzime</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => setShowReportMileage((previous) => !previous)}
                className="rounded-xl border border-white/10 bg-deep px-4 py-2 text-sm font-semibold text-white transition hover:border-mint/40 hover:text-mint"
              >
                {showReportMileage ? "Mbylle" : "Kilometrazhi"}
              </button>

              <button
                type="button"
                onClick={() => downloadReportPdf("all")}
                disabled={!hasAnyReportData}
                className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-2 text-sm font-semibold text-mint transition hover:bg-mint/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Shkarko raportin (PDF)
              </button>

              {showReportMileage && (
                <section className="mt-2 w-full rounded-2xl bg-[linear-gradient(145deg,#f6fbf9,#eef6f4)] p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold">Kilometrazhi i veturës</h3>
                      <p className="text-xs text-slate-400">Ruhet automatikisht nga regjistrimi dhe servisimet</p>
                    </div>
                    {typeof mileageDifference === "number" && (
                      <span className="rounded-lg border border-mint/20 bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">
                        {mileageDifference >= 0 ? "+" : ""}
                        {mileageDifference.toLocaleString("sq-AL")} km nga regjistrimi
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <article className="rounded-xl border border-white/10 bg-deep/35 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">KM në regjistrim</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {typeof registrationMileage === "number" ? `${registrationMileage.toLocaleString("sq-AL")} km` : "—"}
                      </p>
                    </article>

                    <article className="rounded-xl border border-white/10 bg-deep/35 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">KM aktuale</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {typeof currentMileage === "number" ? `${currentMileage.toLocaleString("sq-AL")} km` : "—"}
                      </p>
                    </article>

                    <article className="rounded-xl border border-white/10 bg-deep/35 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Përditësimi i fundit</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {latestServiceWithMileage ? formatDate(latestServiceWithMileage.service_date) : "Nga regjistrimi"}
                      </p>
                    </article>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-deep/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Historia e kilometrave</p>
                      <span className="text-xs text-slate-500">{mileageTimelineRows.length} hyrje</span>
                    </div>

                    {mileageTimelineRows.length > 0 ? (
                      <div className="space-y-2">
                        {mileageTimelineRows.map((row) => (
                          <article
                            key={`mileage-row-${row.id}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{row.label}</p>
                              <p className="text-xs text-slate-400">{formatDate(row.date)}</p>
                            </div>
                            <span className="rounded-lg border border-white/10 bg-deep/40 px-2.5 py-1 text-xs font-semibold text-mint">
                              {row.mileage.toLocaleString("sq-AL")} km
                            </span>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">Nuk ka hyrje të kilometrave ende.</p>
                    )}
                  </div>
                </section>
              )}
            </div>

            {reportEventFilter === "all" ? (
              <div className="space-y-6">
                <section className="dashboard-panel rounded-2xl p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">Dokumente</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadReportPdf("documents")}
                        disabled={reportDocuments.length === 0}
                        className="rounded-md border border-[#93c5fd] bg-[#dbeafe] px-2 py-1 text-[11px] font-semibold text-[#1d4ed8] transition hover:bg-[#bfdbfe] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        PDF
                      </button>
                      <span className="rounded-full border border-[#93c5fd] bg-[#dbeafe] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
                        {reportDocuments.length}
                      </span>
                    </div>
                  </div>
                  {reportDocuments.length > 0 ? (
                    <div className="space-y-3">
                      {reportDocuments.map((document) => (
                        <DocumentCard
                          key={`report-document-${document.id}`}
                          document={document}
                          onEdit={handleEditDocument}
                          onDelete={handleDeleteDocument}
                          showActions={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty-state rounded-xl p-4 text-sm">
                      Nuk ka dokumente për filtrin aktual.
                    </div>
                  )}
                </section>

                <section className="dashboard-panel rounded-2xl p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">Servisime</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadReportPdf("services")}
                        disabled={reportServices.length === 0}
                        className="rounded-md border border-[#fcd34d] bg-[#fef3c7] px-2 py-1 text-[11px] font-semibold text-[#b45309] transition hover:bg-[#fde68a] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        PDF
                      </button>
                      <span className="rounded-full border border-[#fcd34d] bg-[#fef3c7] px-3 py-1 text-xs font-semibold text-[#b45309]">
                        {reportServices.length}
                      </span>
                    </div>
                  </div>
                  {reportServices.length > 0 ? (
                    <div className="space-y-3">
                      {reportServices.map((service) => (
                        <ServiceCard
                          key={`report-service-${service.id}`}
                          service={service}
                          onEdit={handleEditService}
                          onDelete={handleDeleteService}
                          showActions={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty-state rounded-xl p-4 text-sm">
                      Nuk ka servisime për filtrin aktual.
                    </div>
                  )}
                </section>

                <section className="dashboard-panel rounded-2xl p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">Shpenzime</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadReportPdf("expenses")}
                        disabled={reportExpenses.length === 0}
                        className="rounded-md border border-[#d8b4fe] bg-[#f3e8ff] px-2 py-1 text-[11px] font-semibold text-[#7c3aed] transition hover:bg-[#e9d5ff] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        PDF
                      </button>
                      <span className="rounded-full border border-[#d8b4fe] bg-[#f3e8ff] px-3 py-1 text-xs font-semibold text-[#7c3aed]">
                        {reportExpenses.length}
                      </span>
                    </div>
                  </div>
                  {reportExpenses.length > 0 ? (
                    <div className="space-y-3">
                      {reportExpenses.map((expense) => (
                        <ExpenseCard
                          key={`report-expense-${expense.id}`}
                          expense={expense}
                          onEdit={handleEditExpense}
                          onDelete={handleDeleteExpense}
                          showActions={false}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-empty-state rounded-xl p-4 text-sm">
                      Nuk ka shpenzime për filtrin aktual.
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <section className="dashboard-panel space-y-4 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">Historia e plotë</h3>
                  <span className="rounded-full border border-[#dbe3ea] bg-[#f5f7fa] px-3 py-1 text-xs font-semibold text-[#4b5563]">
                    {reportHistoryRows.length} rreshta
                  </span>
                </div>

                {latestReportRows.length > 0 && (
                  <div className="rounded-2xl border border-mint/20 bg-gradient-to-r from-mint/10 to-emerald-500/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mint">Të rejat</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {latestReportRows.map((row) => {
                        const kindBadgeClass =
                          row.kind === "documents"
                            ? "border-[#93c5fd] bg-[#dbeafe] text-[#1d4ed8]"
                            : row.kind === "services"
                              ? "border-[#fcd34d] bg-[#fef3c7] text-[#b45309]"
                              : "border-[#d8b4fe] bg-[#f3e8ff] text-[#7c3aed]";

                        return (
                          <article key={`latest-${row.id}`} className="rounded-xl border border-white/10 bg-deep/40 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${kindBadgeClass}`}>
                                {row.source}
                              </span>
                              <span className="text-xs text-slate-400">{formatDate(row.date)}</span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">{row.label}</p>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reportHistoryRows.length > 0 ? (
                  <div className="grid gap-3">
                    {reportHistoryRows.map((row) => {
                      const kindBadgeClass =
                        row.kind === "documents"
                            ? "border-[#93c5fd] bg-[#dbeafe] text-[#1d4ed8]"
                          : row.kind === "services"
                            ? "border-[#fcd34d] bg-[#fef3c7] text-[#b45309]"
                            : "border-[#d8b4fe] bg-[#f3e8ff] text-[#7c3aed]";

                      return (
                        <article
                          key={row.id}
                          className="rounded-xl border border-white/10 bg-deep/35 p-4 transition hover:border-white/20"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${kindBadgeClass}`}>
                                  {row.source}
                                </span>
                                <span className="text-xs text-slate-400">{formatDate(row.date)}</span>
                              </div>
                              <p className="mt-2 text-sm font-semibold text-white">{row.label}</p>
                            </div>
                            {typeof row.amount === "number" && row.amount > 0 ? (
                              <span className="rounded-lg border border-[#dbe3ea] bg-[#f5f7fa] px-2.5 py-1 text-xs font-semibold text-[#2D3A3A]">
                                {formatCurrency(row.amount)}
                              </span>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="dashboard-empty-state rounded-xl p-6 text-center text-sm">
                    Nuk ka histori për filtrin aktual.
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Sub-components

function StatCard({
  label,
  value,
  sublabel,
  color,
  onClick
}: {
  label: string;
  value: string;
  sublabel?: string;
  color: "mint" | "blue" | "purple" | "amber" | "slate";
  onClick?: () => void;
}) {
  const colorClasses = {
    mint: "bg-[linear-gradient(145deg,#f7fbfa,#eef8f4)] text-[#2D3A3A]",
    blue: "bg-[linear-gradient(145deg,#f7fafe,#eef4fb)] text-[#285a74]",
    purple: "bg-[linear-gradient(145deg,#fbf8fe,#f4eefb)] text-[#6b4ea0]",
    amber: "bg-[linear-gradient(145deg,#fffaf2,#fdf3df)] text-[#b45309]",
    slate: "bg-[linear-gradient(145deg,#f8fafc,#eff3f7)] text-[#475467]"
  };

  const className = `rounded-2xl p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)] ${colorClasses[color]} ${
    onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0px_16px_38px_rgba(0,0,0,0.08)]" : ""
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <div className="text-left text-sm text-[#6B7280]">{label}</div>
        <p className="mt-3 text-left text-2xl font-bold text-[#1F2937]">{value}</p>
        {sublabel ? <p className="mt-1 text-left text-xs text-[#6B7280]">{sublabel}</p> : null}
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="text-sm text-[#6B7280]">{label}</div>
      <p className="mt-3 text-2xl font-bold text-[#1F2937]">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-[#6B7280]">{sublabel}</p> : null}
    </div>
  );
}

function DocumentRow({ document }: { document: DocumentRow }) {
  const status = getDocumentStatus(document.expires_on);
  const docType = DOCUMENT_TYPES[document.document_type] || DOCUMENT_TYPES.other;

  const statusColors = {
    red: "text-[#b42318]",
    amber: "text-[#b45309]",
    yellow: "text-[#b45309]",
    emerald: "text-[#2D6A4F]",
    slate: "text-[#6B7280]"
  };

  return (
    <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
      <div>
        <p className="font-medium text-[#1F2937]">{docType.label}</p>
        {document.expires_on && <p className="text-xs text-[#6B7280]">{formatDate(document.expires_on)}</p>}
        {document.file_url && (
          <a href={document.file_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#2D3A3A] hover:underline">
            Hap skedarin
          </a>
        )}
      </div>
      {status.status !== "unknown" ? (
        <span className={`text-sm font-semibold ${statusColors[status.color as keyof typeof statusColors]}`}>
          {status.label}
        </span>
      ) : null}
    </div>
  );
}

function DocumentCard({
  document,
  onEdit,
  onDelete,
  showActions = false
}: {
  document: DocumentRow;
  onEdit: (document: DocumentRow) => void;
  onDelete: (document: DocumentRow) => void;
  showActions?: boolean;
}) {
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
    <div className={`rounded-2xl p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)] ${bgColors[status.color as keyof typeof bgColors]}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-[#6B7280]">{docType.label}</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              status.color === "red"
                ? "bg-[#fee4e2] text-[#b42318]"
                : status.color === "amber"
                  ? "bg-[#fef3c7] text-[#b45309]"
                  : status.color === "emerald"
                    ? "bg-[#dcfce7] text-[#166534]"
                    : "bg-[#eef2f6] text-[#6B7280]"
            }`}
          >
            {status.label}
          </span>
          {showActions ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(document)}
                className="rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#e5e7eb]"
              >
                Editoje
              </button>
              <button
                type="button"
                onClick={() => onDelete(document)}
                className="rounded-lg border border-[#fda29b] bg-[#fee4e2] px-3 py-1.5 text-xs font-semibold text-[#b42318] transition hover:bg-[#fecdca]"
              >
                Fshije
              </button>
            </>
          ) : null}
        </div>
      </div>
      <h4 className="mt-4 font-display text-lg font-bold text-[#1F2937]">{document.reference_number || docType.label}</h4>
      <div className="mt-3 space-y-1 text-sm text-[#6B7280]">
        <p>Lloji: {docType.label}</p>
        {document.expires_on && <p>Skadon: {formatDate(document.expires_on)}</p>}
        <p>Statusi: {reportStatus === "expired" ? "Skaduar" : reportStatus === "expiring" ? "Po skadon" : "OK"}</p>
        {document.issuer && <p>Lëshuar nga: {document.issuer}</p>}
        {document.file_url && (
          <a href={document.file_url} target="_blank" rel="noreferrer" className="text-[#2D3A3A] hover:underline">
            Hap skedarin
          </a>
        )}
      </div>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceRecordRow }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
      <div>
        <p className="font-medium text-[#1F2937]">{service.service_type}</p>
        <p className="text-xs text-[#6B7280]">{formatDate(service.service_date)}</p>
      </div>
      {service.cost > 0 ? <span className="font-semibold text-[#2D3A3A]">{formatCurrency(service.cost)}</span> : null}
    </div>
  );
}

function ServiceCard({
  service,
  onEdit,
  onDelete,
  showActions = true
}: {
  service: ServiceRecordRow;
  onEdit: (service: ServiceRecordRow) => void;
  onDelete: (service: ServiceRecordRow) => void;
  showActions?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-display text-lg font-bold text-[#1F2937]">{service.service_type}</h4>
          <p className="text-sm text-[#6B7280]">{formatDate(service.service_date)}</p>
        </div>
        {showActions ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(service)}
              className="rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#e5e7eb]"
            >
              Editoje
            </button>
            <button
              type="button"
              onClick={() => onDelete(service)}
              className="rounded-lg border border-[#fda29b] bg-[#fee4e2] px-3 py-1.5 text-xs font-semibold text-[#b42318] transition hover:bg-[#fecdca]"
            >
              Fshije
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {service.provider && (
          <span className="rounded-full bg-[#f5f7fa] px-2.5 py-1 text-[#6B7280]">
            {service.provider}
          </span>
        )}
        {isOilChangeServiceType(service.service_type) && service.mileage && (
          <span className="rounded-full bg-[#f5f7fa] px-2.5 py-1 text-[#6B7280]">
            {service.mileage.toLocaleString("sq-AL")} km
          </span>
        )}
        {service.next_service_due_at && (
          <span className="rounded-full bg-[#e7f1ee] px-2.5 py-1 text-[#2D3A3A]">
            Tjetra: {formatDate(service.next_service_due_at)}
          </span>
        )}
      </div>
      {service.notes && <p className="mt-3 text-sm text-[#6B7280]">{service.notes}</p>}
    </div>
  );
}

function ExpenseCard({
  expense,
  onEdit,
  onDelete,
  showActions = false
}: {
  expense: ExpenseRow;
  onEdit: (expense: ExpenseRow) => void;
  onDelete: (expense: ExpenseRow) => void;
  showActions?: boolean;
}) {
  const receiptUrl = extractFirstUrl(expense.notes);

  return (
    <div className="rounded-xl bg-white p-4 shadow-[0px_10px_30px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1F2937]">{expense.category}</p>
          <p className="text-xs text-[#6B7280]">
            {formatDate(expense.expense_date)}
            {expense.vendor && ` • ${expense.vendor}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#2D3A3A]">{formatCurrency(expense.amount)}</span>
          {showActions ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(expense)}
                className="rounded-lg bg-[#f3f4f6] px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#e5e7eb]"
              >
                Editoje
              </button>
              <button
                type="button"
                onClick={() => onDelete(expense)}
                className="rounded-lg border border-[#fda29b] bg-[#fee4e2] px-3 py-1.5 text-xs font-semibold text-[#b42318] transition hover:bg-[#fecdca]"
              >
                Fshije
              </button>
            </>
          ) : null}
        </div>
      </div>
      {expense.notes && <p className="mt-3 whitespace-pre-line text-sm text-[#6B7280]">{expense.notes}</p>}
      {receiptUrl && (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-sm font-semibold text-[#2D3A3A] hover:underline"
        >
          Hap foton/kuponin
        </a>
      )}
    </div>
  );
}

export default VehicleDashboardPage;
