import type { VehicleData } from "./database.types";
import { SUPABASE_ANON_KEY, supabase } from "./supabase";

const GENERATED_PLACEHOLDER_PREFIX = "data:image/svg+xml,";
const vehicleImageRequestCache = new Map<string, Promise<string>>();
const enableCarsXeDevProxy = import.meta.env.DEV && import.meta.env.VITE_ENABLE_CARSXE_DEV_PROXY === "true";
const lowQualityImageKeywords = [
  "carsized",
  "alicdn",
  "aliexpress",
  "ebayimg",
  "amazon",
  "maxtondesign",
  "upgrademycar",
  "carmatsking",
  "allegroimg",
  "shopify",
  "head lamp",
  "head-lamp",
  "lamp",
  "splitter",
  "skirt",
  "skirts",
  "steering",
  "paddle",
  "badge",
  "sensor",
  "mat",
  "mats",
  "bumper",
  "mirror",
  "headlight",
  "taillight",
  "wheel",
  "rim",
  "brake",
  "interior",
  "seat",
  "exhaust",
  "spoiler",
  "accessories",
  "accessory",
  "part",
  "parts",
  "carbon",
  "diffuser",
  "custom"
];

// Markat dhe modelet e veturave (të përdorura në Kosovë dhe Shqipëri)
// Sorted by popularity in Kosovo/Albania market
export const CAR_MAKES = [
  // Më të përdorurat në Kosovë/Shqipëri
  "Mercedes-Benz", "Volkswagen", "Audi", "BMW", "Škoda", "Renault", "Dacia",
  "Toyota", "Opel", "Peugeot", "Ford", "Fiat", "Hyundai", "Kia", "Citroën",
  "SEAT", "Nissan", "Honda", "Mazda", "Volvo", "Alfa Romeo", "Mitsubishi",
  "Suzuki", "Jeep", "Land Rover", "Porsche", "Lexus", "Mini", "Jaguar",
  "Subaru", "Chevrolet", "Dodge", "Tesla", "BYD", "Lancia", "Chrysler", "Daewoo"
] as const;

export const CAR_MODELS: Record<string, string[]> = {
  // Mercedes-Benz - Shumë e popullarizuar në Shqipëri/Kosovë
  "Mercedes-Benz": [
    "E-Class", "C-Class", "S-Class", "A-Class", "B-Class", 
    "CLA", "CLS", "CLK", "GLA", "GLB", "GLC", "GLE", "GLS", "GL",
    "ML", "GLK", "Vito", "Sprinter", "V-Class",
    "AMG GT", "EQC", "EQS", "EQA", "EQB"
  ],
  // Volkswagen - Golf është ikonë në rajon
  "Volkswagen": [
    "Golf", "Passat", "Polo", "Jetta", "Bora", "Vento",
    "Tiguan", "Touareg", "T-Roc", "T-Cross", "Touran", "Sharan",
    "Arteon", "CC", "Scirocco", "Beetle", "Caddy", "Transporter",
    "ID.3", "ID.4", "ID.5", "ID.7", "Up!", "Lupo"
  ],
  // Audi
  "Audi": [
    "A3", "A4", "A5", "A6", "A7", "A8", "A1", "A2",
    "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron", "Q4 e-tron",
    "TT", "R8", "RS3", "RS4", "RS5", "RS6", "RS7", "S3", "S4", "S5", "S6"
  ],
  // BMW
  "BMW": [
    "Seria 3", "Seria 5", "Seria 1", "Seria 2", "Seria 4", "Seria 6", "Seria 7", "Seria 8",
    "X1", "X2", "X3", "X4", "X5", "X6", "X7",
    "Z3", "Z4", "i3", "i4", "i5", "i7", "iX", "iX3",
    "M3", "M4", "M5", "M8"
  ],
  // Škoda - Shumë e përdorur në Kosovë
  "Škoda": [
    "Octavia", "Fabia", "Superb", "Rapid", "Scala",
    "Kodiaq", "Karoq", "Kamiq", "Yeti",
    "Enyaq", "Elroq", "Felicia", "Roomster"
  ],
  // Renault
  "Renault": [
    "Clio", "Megane", "Scenic", "Laguna", "Fluence", "Talisman",
    "Captur", "Kadjar", "Koleos", "Arkana", "Austral",
    "Zoe", "Twingo", "Symbol", "Kangoo", "Trafic", "Master"
  ],
  // Dacia - Lider në shitje në Kosovë 2025
  "Dacia": [
    "Sandero", "Sandero Stepway", "Logan", "Duster",
    "Spring", "Jogger", "Lodgy", "Dokker"
  ],
  // Toyota
  "Toyota": [
    "Corolla", "Yaris", "Camry", "Avensis", "Auris",
    "RAV4", "Land Cruiser", "Highlander", "C-HR", "Yaris Cross",
    "Prius", "Aygo", "Hilux", "Supra", "bZ4X"
  ],
  // Opel
  "Opel": [
    "Astra", "Corsa", "Insignia", "Vectra", "Zafira", "Meriva",
    "Mokka", "Grandland", "Crossland", "Combo",
    "Vivaro", "Movano", "Adam", "Karl"
  ],
  // Peugeot - Top 5 në Kosovë
  "Peugeot": [
    "308", "208", "508", "408", "3008", "2008", "5008",
    "206", "207", "307", "407", "607",
    "Partner", "Rifter", "Expert", "Boxer"
  ],
  // Ford
  "Ford": [
    "Focus", "Fiesta", "Mondeo", "Fusion", "C-Max", "S-Max", "Galaxy",
    "Kuga", "Puma", "EcoSport", "Explorer", "Edge",
    "Mustang", "Ranger", "Transit", "Transit Connect"
  ],
  // Fiat
  "Fiat": [
    "Punto", "Grande Punto", "Panda", "500", "500X", "500L",
    "Tipo", "Bravo", "Stilo", "Linea", "Doblo",
    "Ducato", "Fiorino", "Qubo"
  ],
  // Hyundai
  "Hyundai": [
    "i30", "i20", "i10", "Elantra", "Sonata", "Accent",
    "Tucson", "Santa Fe", "Kona", "Bayon", "ix35", "ix55",
    "Ioniq 5", "Ioniq 6", "Getz", "Matrix"
  ],
  // Kia
  "Kia": [
    "Ceed", "Rio", "Picanto", "Cerato", "Optima", "Stinger",
    "Sportage", "Sorento", "Niro", "EV6", "EV9",
    "Soul", "Venga", "Carens", "Carnival"
  ],
  // Citroën
  "Citroën": [
    "C3", "C4", "C5", "C1", "C2",
    "C3 Aircross", "C4 Cactus", "C5 Aircross",
    "Berlingo", "Jumpy", "Jumper", "DS3", "DS4", "DS5"
  ],
  // SEAT
  "SEAT": [
    "Ibiza", "Leon", "Toledo", "Cordoba", "Altea",
    "Arona", "Ateca", "Tarraco", "Alhambra", "Mii"
  ],
  // Nissan
  "Nissan": [
    "Qashqai", "Juke", "X-Trail", "Micra", "Note", "Almera", "Primera",
    "Pathfinder", "Navara", "Patrol", "Murano",
    "Leaf", "Ariya", "GT-R", "350Z", "370Z"
  ],
  // Honda
  "Honda": [
    "Civic", "Accord", "Jazz", "City", "HR-V", "CR-V",
    "Pilot", "CR-Z", "Insight", "e:Ny1", "ZR-V"
  ],
  // Mazda
  "Mazda": [
    "3", "6", "2", "CX-3", "CX-30", "CX-5", "CX-60", "CX-9",
    "MX-5", "MX-30", "RX-8"
  ],
  // Volvo
  "Volvo": [
    "V40", "V50", "V60", "V70", "V90", "S40", "S60", "S80", "S90",
    "XC40", "XC60", "XC70", "XC90", "C30", "C40 Recharge", "EX30", "EX90"
  ],
  // Alfa Romeo
  "Alfa Romeo": [
    "Giulietta", "Giulia", "Stelvio", "Tonale",
    "147", "156", "159", "166", "MiTo", "Brera", "Spider"
  ],
  // Mitsubishi
  "Mitsubishi": [
    "Lancer", "Outlander", "ASX", "Pajero", "L200",
    "Eclipse Cross", "Colt", "Space Star", "Galant"
  ],
  // Suzuki
  "Suzuki": [
    "Swift", "Vitara", "SX4", "S-Cross", "Jimny", "Ignis",
    "Alto", "Splash", "Celerio", "Baleno", "Grand Vitara"
  ],
  // Jeep
  "Jeep": [
    "Renegade", "Compass", "Cherokee", "Grand Cherokee",
    "Wrangler", "Gladiator", "Avenger", "Commander"
  ],
  // Land Rover
  "Land Rover": [
    "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque",
    "Discovery", "Discovery Sport", "Defender", "Freelander"
  ],
  // Porsche
  "Porsche": [
    "Cayenne", "Macan", "Panamera", "911", "Taycan",
    "718 Cayman", "718 Boxster"
  ],
  // Lexus
  "Lexus": [
    "IS", "ES", "GS", "LS", "CT", "NX", "RX", "UX", "GX", "LX",
    "LC", "RC", "RZ"
  ],
  // Mini
  "Mini": [
    "Cooper", "Cooper S", "One", "Countryman", "Clubman",
    "Paceman", "Cabrio", "Electric"
  ],
  // Jaguar
  "Jaguar": [
    "XE", "XF", "XJ", "F-Type", "E-Pace", "F-Pace", "I-Pace"
  ],
  // Subaru
  "Subaru": [
    "Impreza", "Legacy", "Outback", "Forester", "XV",
    "WRX", "BRZ", "Levorg", "Ascent"
  ],
  // Chevrolet
  "Chevrolet": [
    "Cruze", "Aveo", "Spark", "Captiva", "Trax",
    "Camaro", "Corvette", "Malibu", "Orlando"
  ],
  // Dodge
  "Dodge": ["Challenger", "Charger", "Durango", "Journey", "Nitro"],
  // Tesla
  "Tesla": ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  // BYD - Duke u rritur në Shqipëri
  "BYD": ["Seagull", "Dolphin", "Seal", "Atto 3", "Yuan Plus", "Song Plus", "Han", "Tang"],
  // Lancia
  "Lancia": ["Ypsilon", "Delta", "Musa", "Thesis"],
  // Chrysler
  "Chrysler": ["300C", "Voyager", "PT Cruiser", "Sebring"],
  // Daewoo (ende ka në rrugë)
  "Daewoo": ["Matiz", "Kalos", "Lacetti", "Nubira", "Leganza", "Lanos"]
};

export const BODY_TYPES = [
  { value: "sedan", label: "Sedan" },
  { value: "hatchback", label: "Hatchback" },
  { value: "suv", label: "Xhip" },
  { value: "crossover", label: "Crossover" },
  { value: "coupe", label: "Coupe" },
  { value: "convertible", label: "Kabriolet" },
  { value: "wagon", label: "Karavan" },
  { value: "van", label: "Van / Furgon" },
  { value: "pickup", label: "Pickup" }
] as const;

export const FUEL_TYPES = [
  { value: "petrol", label: "Benzinë" },
  { value: "diesel", label: "Naftë" },
  { value: "hybrid", label: "Hibrid" },
  { value: "electric", label: "Elektrik" },
  { value: "lpg", label: "LPG / Gaz" },
  { value: "phev", label: "Plug-in Hybrid" }
] as const;

export const TRANSMISSION_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatik" },
  { value: "cvt", label: "CVT" },
  { value: "dct", label: "DCT / Dual Clutch" }
] as const;

export const USAGE_TYPES = [
  { value: "personal", label: "Përdorim Personal" },
  { value: "family", label: "Familjar" },
  { value: "business", label: "Biznes" },
  { value: "sport", label: "Sportiv / Weekend" },
  { value: "utility", label: "Punë / Transport" }
] as const;

export const COLORS = [
  { value: "white", label: "E bardhë", hex: "#FFFFFF" },
  { value: "black", label: "E zezë", hex: "#1a1a1a" },
  { value: "silver", label: "Argjend", hex: "#C0C0C0" },
  { value: "gray", label: "Gri", hex: "#808080" },
  { value: "red", label: "E kuqe", hex: "#DC2626" },
  { value: "blue", label: "Blu", hex: "#2563EB" },
  { value: "green", label: "E gjelbër", hex: "#16A34A" },
  { value: "brown", label: "Kafe", hex: "#78350F" },
  { value: "beige", label: "Bezhë", hex: "#D4B896" },
  { value: "orange", label: "Portokalli", hex: "#EA580C" },
  { value: "yellow", label: "E verdhë", hex: "#EAB308" }
] as const;

// Generate years from current year back to 1990
export function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear + 1; year >= 1990; year--) {
    years.push(year);
  }
  return years;
}

function buildVehicleImageCacheKey(
  make: string,
  model: string,
  year?: number,
  bodyType?: string,
  color?: string
) {
  return [make.trim().toLowerCase(), model.trim().toLowerCase(), year ?? "", bodyType ?? "", color ?? ""].join("|");
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toPrimaryModelVariant(model: string, make: string) {
  let normalizedModel = normalizeSpaces(stripDiacritics(model.trim()));

  if (/^bmw$/i.test(make)) {
    const bmwSeriesMatch = normalizedModel.match(/^seria\s*([1-8])$/i);
    if (bmwSeriesMatch) {
      return `${bmwSeriesMatch[1]} Series`;
    }
  }

  normalizedModel = normalizedModel.replace(/\bklasa\b/gi, "Class");
  normalizedModel = normalizedModel.replace(/\bseria\b/gi, "Series");

  const spacedAlphaNumeric = normalizedModel.match(/^([A-Za-z]{1,3})\s+([0-9]{1,3}[A-Za-z]?)$/);
  if (spacedAlphaNumeric) {
    normalizedModel = `${spacedAlphaNumeric[1]}${spacedAlphaNumeric[2]}`;
  }

  const hyphenClass = normalizedModel.match(/^([A-Za-z]{1,2})\s*[- ]\s*Class$/i);
  if (hyphenClass) {
    normalizedModel = `${hyphenClass[1]}-Class`;
  }

  if (/^id\s*\.?\s*[0-9]$/i.test(normalizedModel)) {
    normalizedModel = normalizedModel.replace(/\s+/g, "").replace(/^id/i, "ID").replace(/^ID(\d)/, "ID.$1");
  }

  return normalizedModel;
}

function normalizeVehicleSearchInput(make: string, model: string) {
  const normalizedMake = normalizeSpaces(stripDiacritics(make.trim()));
  const normalizedModel = toPrimaryModelVariant(model, normalizedMake);

  if (/^mercedes\s*-?\s*benz$/i.test(normalizedMake)) {
    return {
      make: "Mercedes-Benz",
      model: normalizedModel
    };
  }

  if (/^skoda$/i.test(normalizedMake)) {
    return {
      make: "Skoda",
      model: normalizedModel
    };
  }

  return {
    make: normalizedMake,
    model: normalizedModel
  };
}

async function fetchCarsXeImageDirect(
  make: string,
  model: string,
  year?: number,
  color?: string
): Promise<string | null> {
  if (!enableCarsXeDevProxy) {
    return null;
  }

  const normalizedVehicle = normalizeVehicleSearchInput(make, model);

  const params = new URLSearchParams({
    make: normalizedVehicle.make,
    model: normalizedVehicle.model
  });

  if (year) {
    params.set("year", String(year));
  }

  if (color) {
    params.set("color", color);
  }

  try {
    const response = await fetch(`/api/vehicle-image?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { imageUrl?: string | null; provider?: string | null };

    return payload.imageUrl ?? null;
  } catch {
    return null;
  }
}

async function fetchCarsXeImage(
  make: string,
  model: string,
  year?: number,
  color?: string
): Promise<string | null> {
  if (!make.trim() || !model.trim()) {
    return null;
  }

  try {
    const normalizedVehicle = normalizeVehicleSearchInput(make, model);

    const invokeVehicleImage = async () => {
      const { data, error } = await supabase.functions.invoke<{
        imageUrl?: string | null;
        provider?: string | null;
        error?: string;
      }>("vehicle-image", {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: {
          make: normalizedVehicle.make,
          model: normalizedVehicle.model,
          year: year ?? null,
          color: color ?? null
        }
      });

      return {
        data: error ? null : (data ?? null),
        error
      };
    };

    let { data, error } = await invokeVehicleImage();

    const errorStatus =
      typeof (error as { context?: { status?: number } } | null)?.context?.status === "number"
        ? (error as { context?: { status?: number } }).context?.status ?? null
        : null;

    if (errorStatus === 401) {
      const retryResult = await invokeVehicleImage();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      return fetchCarsXeImageDirect(make, model, year, color);
    }

    return data?.imageUrl ?? (await fetchCarsXeImageDirect(make, model, year, color));
  } catch {
    return fetchCarsXeImageDirect(make, model, year, color);
  }
}

async function fetchWikipediaCarImage(make: string, model: string): Promise<string | null> {
  try {
    const query = `${make}_${model}`.replace(/\s+/g, '_');
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(query)}&pithumbsize=800&format=json&origin=*`;
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages) return null;
    
    // Get the first page's thumbnail
    const pageIds = Object.keys(pages);
    if (pageIds.length > 0 && pageIds[0] !== '-1') {
      const page = pages[pageIds[0]];
      if (page.thumbnail && page.thumbnail.source) {
        return page.thumbnail.source;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Generate a premium placeholder image
function generatePlaceholderImage(make: string, model: string, _bodyType?: string): string {
  // Use a consistent modern gradient based on hash
  const hash = (make + model).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  
  // High-end premium aesthetic for the fallback
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(${hue}, 15%, 25%)" />
          <stop offset="100%" stop-color="hsl(${hue}, 20%, 10%)" />
        </linearGradient>
      </defs>
      <rect width="800" height="500" rx="40" fill="url(#bg)"/>
      
      <!-- Modern, perfectly proportioned sleek car silhouette -->
      <g transform="translate(190, 160)" fill="none" stroke="rgba(255, 255, 255, 0.4)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 40 140 L 70 140 C 70 140 85 80 150 70 C 200 60 260 60 310 70 C 375 80 390 140 390 140 L 410 140 C 430 140 440 155 440 170 L 440 200 C 440 215 430 230 410 230 L 370 230 M 80 230 L 10 230 C -10 230 -20 215 -20 200 L -20 170 C -20 155 -10 140 10 140 L 40 140" />
        <!-- Wheels -->
        <circle cx="70" cy="230" r="35" fill="hsl(${hue}, 20%, 10%)" />
        <circle cx="350" cy="230" r="35" fill="hsl(${hue}, 20%, 10%)" />
        <!-- Windows -->
        <path d="M 130 72 L 110 140 M 330 72 L 350 140 M 230 65 L 230 140" stroke-width="8" />
        <!-- Speed/Motion lines to make it dynamic -->
        <path d="M -60 170 L -40 170 M -80 200 L -50 200 M -40 140 L -20 140" stroke="rgba(255,255,255,0.2)" stroke-width="6" />
      </g>
      
      <!-- High-end typography -->
      <text x="400" y="410" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="rgba(255, 255, 255, 0.95)" text-anchor="middle" letter-spacing="1">${make} ${model}</text>
      <text x="400" y="445" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="rgba(255, 255, 255, 0.4)" text-anchor="middle" letter-spacing="4">NO IMAGE AVAILABLE</text>
    </svg>
  `;
  
  return `${GENERATED_PLACEHOLDER_PREFIX}${encodeURIComponent(svg)}`;
}

// Main function to fetch vehicle image
export async function fetchVehicleImage(
  make: string,
  model: string,
  _year?: number,
  bodyType?: string,
  color?: string
): Promise<string> {
  const cacheKey = buildVehicleImageCacheKey(make, model, _year, bodyType, color);
  const cachedRequest = vehicleImageRequestCache.get(cacheKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = (async () => {
    const realImage = await fetchCarsXeImage(make, model, _year, color);

    if (realImage) {
      return realImage;
    }

    // Try Wikipedia API as a highly reliable free fallback before giving up
    const wikiImage = await fetchWikipediaCarImage(make, model);
    if (wikiImage) {
      return wikiImage;
    }

    return generatePlaceholderImage(make, model, bodyType);
  })();

  vehicleImageRequestCache.set(cacheKey, request);

  try {
    const resolved = await request;

    // Keep cache only for non-generated images so future attempts can retry APIs.
    if (isGeneratedVehiclePlaceholder(resolved)) {
      vehicleImageRequestCache.delete(cacheKey);
    }

    return resolved;
  } catch (error) {
    vehicleImageRequestCache.delete(cacheKey);
    throw error;
  }
}

export function isGeneratedVehiclePlaceholder(url?: string | null): boolean {
  if (!url) {
    return true;
  }

  const normalized = url.toLowerCase();

  return (
    normalized.startsWith(GENERATED_PLACEHOLDER_PREFIX) ||
    normalized.includes("source.unsplash.com") ||
    lowQualityImageKeywords.some((keyword) => normalized.includes(keyword))
  );
}

export function getRenderableVehicleImageUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }

  if (!import.meta.env.DEV) {
    return url;
  }

  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return url;
    }

    return `/api/image-proxy?src=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return url;
  }
}

// Search for vehicle data (mock implementation - in production would call actual API)
export async function searchVehicleData(
  make: string,
  model: string,
  year?: number
): Promise<VehicleData | null> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Basic validation
  if (!make || !model) {
    return null;
  }
  
  // Generate reasonable defaults based on make/model
  const bodyType = inferBodyType(make, model);
  const fuelType = inferFuelType(make, model, year);
  const transmission = inferTransmission(make, model, year);
  
  const imageUrl = await fetchVehicleImage(make, model, year, bodyType);
  
  return {
    make,
    model,
    year: year ?? new Date().getFullYear(),
    body_type: bodyType,
    fuel_type: fuelType,
    transmission,
    image_url: imageUrl
  };
}

// Infer body type from model name
function inferBodyType(make: string, model: string, _year?: number): string {
  const modelLower = model.toLowerCase();
  const makeLower = make.toLowerCase();
  
  // SUV/Crossover indicators
  if (
    modelLower.includes("x") && makeLower === "bmw" ||
    modelLower.includes("q") && makeLower === "audi" ||
    modelLower.includes("gl") && makeLower === "mercedes-benz" ||
    modelLower.includes("suv") ||
    modelLower.includes("crossover") ||
    ["rav4", "cr-v", "tiguan", "tucson", "sportage", "outback", "forester", "explorer", "pilot"].some(s => modelLower.includes(s))
  ) {
    return "suv";
  }
  
  // Hatchback indicators
  if (
    modelLower.includes("golf") ||
    modelLower.includes("polo") ||
    modelLower.includes("civic") ||
    modelLower.includes("focus") ||
    modelLower.includes("corsa") ||
    modelLower.includes("fiesta") ||
    modelLower.includes("clio") ||
    modelLower.includes("yaris") ||
    modelLower.includes("i3") ||
    modelLower.includes("id.")
  ) {
    return "hatchback";
  }
  
  // Coupe indicators
  if (
    modelLower.includes("coupe") ||
    modelLower.includes("mustang") ||
    modelLower.includes("camaro") ||
    modelLower.includes("911") ||
    modelLower.includes("tt") ||
    modelLower.includes("z4") ||
    modelLower.includes("supra") ||
    modelLower.includes("gt")
  ) {
    return "coupe";
  }
  
  // Wagon indicators
  if (
    modelLower.includes("wagon") ||
    modelLower.includes("avant") ||
    modelLower.includes("touring") ||
    modelLower.includes("estate") ||
    modelLower.includes("v60") ||
    modelLower.includes("v90")
  ) {
    return "wagon";
  }
  
  // Pickup indicators
  if (
    modelLower.includes("f-150") ||
    modelLower.includes("silverado") ||
    modelLower.includes("ranger") ||
    modelLower.includes("tacoma") ||
    modelLower.includes("gladiator") ||
    modelLower.includes("cybertruck")
  ) {
    return "pickup";
  }
  
  // Default to sedan
  return "sedan";
}

// Infer fuel type
function inferFuelType(make: string, model: string, year?: number): string {
  const modelLower = model.toLowerCase();
  const makeLower = make.toLowerCase();
  
  // Electric
  if (
    makeLower === "tesla" ||
    modelLower.includes("electric") ||
    modelLower.includes("ev") ||
    modelLower.includes("e-tron") ||
    modelLower.includes("i3") ||
    modelLower.includes("i4") ||
    modelLower.includes("ix") ||
    modelLower.includes("id.") ||
    modelLower.includes("leaf") ||
    modelLower.includes("ioniq") ||
    modelLower.includes("mach-e") ||
    modelLower.includes("taycan") ||
    modelLower.includes("eqs") ||
    modelLower.includes("eqc")
  ) {
    return "electric";
  }
  
  // Hybrid
  if (
    modelLower.includes("hybrid") ||
    modelLower.includes("prius") ||
    modelLower.includes("phev")
  ) {
    return "hybrid";
  }
  
  // Default based on year and region (European tendency towards diesel)
  if (year && year < 2018) {
    return "diesel";
  }
  
  return "petrol";
}

// Infer transmission
function inferTransmission(make: string, model: string, year?: number): string {
  const modelLower = model.toLowerCase();
  const makeLower = make.toLowerCase();
  
  // Sports cars often manual
  if (
    modelLower.includes("911") ||
    modelLower.includes("mustang") ||
    modelLower.includes("mx-5") ||
    modelLower.includes("brz") ||
    modelLower.includes("86") ||
    modelLower.includes("wrx")
  ) {
    return "manual";
  }
  
  // Electric cars are always automatic
  if (
    makeLower === "tesla" ||
    modelLower.includes("ev") ||
    modelLower.includes("electric") ||
    modelLower.includes("e-tron") ||
    modelLower.includes("id.")
  ) {
    return "automatic";
  }
  
  // Modern luxury brands tend to be automatic
  if (
    ["bmw", "mercedes-benz", "audi", "lexus", "porsche", "jaguar", "land rover"].includes(makeLower) &&
    year && year >= 2015
  ) {
    return "automatic";
  }
  
  // Default based on year
  if (year && year >= 2020) {
    return "automatic";
  }
  
  return "manual";
}

// Validate Kosovo/Albania license plate format
export function validateLicensePlate(plate: string): boolean {
  if (!plate) return false;
  
  // Kosovo plates: XX-XXX-XX (letters-numbers-letters)
  const kosovoPattern = /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/i;
  
  // Albania plates: XX XXXX XX
  const albaniaPattern = /^[A-Z]{2}\s?\d{3,4}\s?[A-Z]{1,2}$/i;
  
  // Generic European pattern
  const genericPattern = /^[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{2,4}[-\s]?[A-Z0-9]{2,3}$/i;
  
  return kosovoPattern.test(plate) || albaniaPattern.test(plate) || genericPattern.test(plate);
}

// Validate VIN
export function validateVIN(vin: string): boolean {
  if (!vin) return false;
  
  // VIN must be exactly 17 characters
  if (vin.length !== 17) return false;
  
  // VIN cannot contain I, O, Q
  if (/[IOQ]/i.test(vin)) return false;
  
  // Must be alphanumeric
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}
