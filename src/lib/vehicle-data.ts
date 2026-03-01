import type { VehicleData } from "./database.types";
import { supabase } from "./supabase";

const GENERATED_PLACEHOLDER_PREFIX = "data:image/svg+xml,";
const vehicleImageRequestCache = new Map<string, Promise<string>>();
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
  { value: "suv", label: "SUV / Xhip" },
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

async function fetchCarsXeImageDirect(
  make: string,
  model: string,
  year?: number,
  color?: string
): Promise<string | null> {
  if (!import.meta.env.DEV) {
    return null;
  }

  const params = new URLSearchParams({
    make,
    model
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
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return fetchCarsXeImageDirect(make, model, year, color);
    }

    const { data, error } = await supabase.functions.invoke<{
      imageUrl?: string | null;
      provider?: string | null;
    }>("vehicle-image", {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: {
        make,
        model,
        year: year ?? null,
        color: color ?? null
      }
    });

    if (error) {
      return fetchCarsXeImageDirect(make, model, year, color);
    }

    return data?.imageUrl ?? (await fetchCarsXeImageDirect(make, model, year, color));
  } catch {
    return fetchCarsXeImageDirect(make, model, year, color);
  }
}

// Strategy 2: Generate a placeholder with car silhouette based on body type
function generatePlaceholderImage(make: string, model: string, bodyType?: string): string {
  // Use a consistent hash for the same make/model to get the same color
  const hash = (make + model).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  
  // Return an SVG data URL with a car silhouette
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue}, 25%, 18%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue}, 35%, 12%);stop-opacity:1" />
        </linearGradient>
        <linearGradient id="car" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:hsl(${hue}, 60%, 55%);stop-opacity:1" />
          <stop offset="100%" style="stop-color:hsl(${hue}, 50%, 40%);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#bg)"/>
      <g transform="translate(100, 180)">
        ${getCarSilhouettePath(bodyType)}
      </g>
      <text x="400" y="440" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="rgba(255,255,255,0.9)" text-anchor="middle">${make} ${model}</text>
    </svg>
  `;
  
  return `${GENERATED_PLACEHOLDER_PREFIX}${encodeURIComponent(svg)}`;
}

function getCarSilhouettePath(bodyType?: string): string {
  // Different silhouettes based on body type
  switch (bodyType?.toLowerCase()) {
    case "suv":
    case "crossover":
      return `<path d="M50 120 L80 120 L100 80 L180 60 L450 60 L500 80 L520 120 L550 120 L560 130 L560 150 L530 150 L520 170 L480 170 L470 150 L130 150 L120 170 L80 170 L70 150 L40 150 L40 130 Z" fill="url(#car)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
             <circle cx="130" cy="165" r="35" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <circle cx="470" cy="165" r="35" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <rect x="120" y="70" width="100" height="45" rx="5" fill="rgba(100,200,255,0.3)"/>
             <rect x="320" y="70" width="120" height="45" rx="5" fill="rgba(100,200,255,0.3)"/>`;
    case "hatchback":
      return `<path d="M50 140 L90 140 L110 100 L180 70 L380 70 L450 100 L480 140 L530 140 L540 150 L540 165 L510 165 L500 180 L460 180 L450 165 L140 165 L130 180 L90 180 L80 165 L50 165 L50 150 Z" fill="url(#car)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
             <circle cx="130" cy="175" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <circle cx="450" cy="175" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <path d="M130 80 L170 80 L180 110 L115 110 Z" fill="rgba(100,200,255,0.3)"/>
             <rect x="250" y="80" width="130" height="45" rx="5" fill="rgba(100,200,255,0.3)"/>`;
    case "coupe":
    case "convertible":
      return `<path d="M40 145 L80 145 L100 105 L200 65 L400 65 L480 105 L510 145 L560 145 L570 155 L570 170 L540 170 L530 185 L490 185 L480 170 L120 170 L110 185 L70 185 L60 170 L30 170 L30 155 Z" fill="url(#car)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
             <circle cx="115" cy="180" r="30" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <circle cx="485" cy="180" r="30" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <path d="M140 75 L190 75 L210 105 L125 105 Z" fill="rgba(100,200,255,0.3)"/>
             <rect x="280" y="75" width="140" height="40" rx="5" fill="rgba(100,200,255,0.3)"/>`;
    case "wagon":
      return `<path d="M40 130 L80 130 L100 90 L180 70 L480 70 L500 90 L510 130 L560 130 L570 140 L570 160 L540 160 L530 175 L490 175 L480 160 L120 160 L110 175 L70 175 L60 160 L30 160 L30 140 Z" fill="url(#car)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
             <circle cx="115" cy="170" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <circle cx="485" cy="170" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <rect x="120" y="75" width="90" height="45" rx="5" fill="rgba(100,200,255,0.3)"/>
             <rect x="260" y="75" width="180" height="45" rx="5" fill="rgba(100,200,255,0.3)"/>`;
    case "pickup":
      return `<path d="M50 120 L90 120 L110 80 L180 60 L280 60 L300 90 L310 120 L550 120 L560 130 L560 155 L530 155 L520 170 L480 170 L470 155 L130 155 L120 170 L80 170 L70 155 L40 155 L40 130 Z" fill="url(#car)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
             <circle cx="125" cy="165" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <circle cx="475" cy="165" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <rect x="120" y="70" width="90" height="40" rx="5" fill="rgba(100,200,255,0.3)"/>
             <rect x="310" y="90" width="220" height="25" fill="rgba(0,0,0,0.3)"/>`;
    default: // sedan
      return `<path d="M40 140 L80 140 L100 100 L180 70 L420 70 L480 100 L510 140 L560 140 L570 150 L570 168 L540 168 L530 183 L490 183 L480 168 L120 168 L110 183 L70 183 L60 168 L30 168 L30 150 Z" fill="url(#car)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
             <circle cx="115" cy="178" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <circle cx="485" cy="178" r="32" fill="#1a1a1a" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
             <path d="M130 80 L175 80 L195 105 L115 105 Z" fill="rgba(100,200,255,0.3)"/>
             <rect x="260" y="80" width="150" height="40" rx="5" fill="rgba(100,200,255,0.3)"/>`;
  }
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

    return generatePlaceholderImage(make, model, bodyType);
  })();

  vehicleImageRequestCache.set(cacheKey, request);

  try {
    return await request;
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
