import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const requestCache = new Map<string, { imageUrl: string | null; expiresAt: number }>();

type VehicleImageRequest = {
  make?: string;
  model?: string;
  year?: number | null;
  color?: string | null;
};

type NormalizedVehicleImageRequest = {
  make: string;
  model: string;
  year: number | null;
  color: string | null;
};

type CarsXeImage = {
  link?: string;
  thumbnailLink?: string;
  contextLink?: string;
  mime?: string;
  hostPageDomainFriendlyName?: string;
  width?: number;
  height?: number;
  byteSize?: number;
};

type CarsXeResponse = {
  success?: boolean;
  error?: string;
  images?: CarsXeImage[];
};

const negativeKeywords = [
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

const positiveKeywords = [
  "front",
  "side",
  "three-quarter",
  "quarter",
  "exterior",
  "profile",
  "caranddriver",
  "topgear",
  "autoexpress",
  "wikipedia",
  "wikimedia",
  "commons.wikimedia",
  "netcarshow",
  "caricos",
  "renault",
  "dealer",
  "cars"
];

const preferredHeroKeywords = ["front", "three-quarter", "quarter", "front-three-quarter"];
const rearAngleKeywords = ["rear", "back"];

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init?.headers ?? {})
    }
  });
}

function normalizeRequest(body: VehicleImageRequest) {
  const nowYear = new Date().getFullYear();
  const make = body.make?.trim();
  const model = body.model?.trim();
  const color = body.color?.trim() || null;
  const year = typeof body.year === "number" && Number.isFinite(body.year) ? Math.trunc(body.year) : null;

  if (!make || !model) {
    return { error: "Both make and model are required." } as const;
  }

  if (make.length > 60 || model.length > 60) {
    return { error: "Make and model must be 60 characters or fewer." } as const;
  }

  if (color && color.length > 30) {
    return { error: "Color must be 30 characters or fewer." } as const;
  }

  if (year !== null && (year < 1950 || year > nowYear + 1)) {
    return { error: `Year must be between 1950 and ${nowYear + 1}.` } as const;
  }

  return {
    value: {
      make,
      model,
      year,
      color
    }
  } as const;
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = normalizeSpaces(raw);
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function addAlphanumericModelVariants(inputModel: string) {
  const variants: string[] = [];
  const model = normalizeSpaces(inputModel);

  const spacedAlphaNumeric = model.match(/^([A-Za-z]{1,3})\s+([0-9]{1,3}[A-Za-z]?)$/);
  if (spacedAlphaNumeric) {
    variants.push(`${spacedAlphaNumeric[1]}${spacedAlphaNumeric[2]}`);
    variants.push(`${spacedAlphaNumeric[1]}-${spacedAlphaNumeric[2]}`);
  }

  const compactAlphaNumeric = model.match(/^([A-Za-z]{1,3})([0-9]{1,3}[A-Za-z]?)$/);
  if (compactAlphaNumeric) {
    variants.push(`${compactAlphaNumeric[1]} ${compactAlphaNumeric[2]}`);
    variants.push(`${compactAlphaNumeric[1]}-${compactAlphaNumeric[2]}`);
  }

  const hyphenClass = model.match(/^([A-Za-z]{1,2})\s*[- ]\s*Class$/i);
  if (hyphenClass) {
    variants.push(`${hyphenClass[1]}-Class`);
    variants.push(`${hyphenClass[1]} Class`);
  }

  if (/^id\s*\.?\s*[0-9]$/i.test(model)) {
    const compactId = model.replace(/\s+/g, "").replace(/^id/i, "ID");
    variants.push(compactId.replace(/^ID(\d)/, "ID.$1"));
    variants.push(compactId.replace(".", ""));
  }

  return variants;
}

function normalizeModelTokens(model: string, make: string) {
  const normalized = stripDiacritics(model);
  const normalizedMake = stripDiacritics(make).toLowerCase();
  const variants = [normalized];

  const bmwSeriesMatch = normalized.match(/^seria\s*([1-8])$/i);
  if (bmwSeriesMatch && normalizedMake === "bmw") {
    variants.push(`${bmwSeriesMatch[1]} Series`);
  }

  variants.push(normalized.replace(/^seria\s+/i, "Series "));
  variants.push(normalized.replace(/\bklasa\b/gi, "Class"));
  variants.push(normalized.replace(/\bseria\b/gi, "Series"));
  variants.push(normalized.replace(/[\-_/]+/g, " "));
  variants.push(...addAlphanumericModelVariants(normalized));

  const translated = normalized.replace(/\bklasa\b/gi, "Class").replace(/\bseria\b/gi, "Series");
  variants.push(...addAlphanumericModelVariants(translated));

  return uniqueNonEmpty(variants).slice(0, 8);
}

function getMakeAliases(make: string) {
  const normalized = stripDiacritics(make);
  const key = normalized.toLowerCase();
  const variants = [normalized, normalized.replace(/-/g, " "), normalized.replace(/\s+/g, "")];

  if (key === "mercedes-benz" || key === "mercedes benz" || key === "mercedes") {
    variants.push("Mercedes-Benz", "Mercedes Benz", "Mercedes");
  }

  if (key === "skoda" || key === "škoda") {
    variants.push("Skoda", "Skoda Auto");
  }

  if (key === "citroen" || key === "citroen") {
    variants.push("Citroen");
  }

  if (key === "vw" || key === "volkswagen") {
    variants.push("Volkswagen", "VW");
  }

  return uniqueNonEmpty(variants).slice(0, 4);
}

function buildSearchPairs(make: string, model: string) {
  const makeVariants = getMakeAliases(make);
  const modelVariants = normalizeModelTokens(model, make);
  const primaryMake = makeVariants[0] ?? make;
  const primaryModel = modelVariants[0] ?? model;
  const pairs: Array<{ make: string; model: string }> = [{ make: primaryMake, model: primaryModel }];

  for (const makeVariant of makeVariants) {
    pairs.push({ make: makeVariant, model: primaryModel });
  }

  for (const modelVariant of modelVariants) {
    pairs.push({ make: primaryMake, model: modelVariant });
  }

  if (makeVariants.length > 1 && modelVariants.length > 1) {
    pairs.push({ make: makeVariants[1], model: modelVariants[1] });
  }

  const uniquePairs = new Set<string>();
  const deduped: Array<{ make: string; model: string }> = [];

  for (const pair of pairs) {
    const key = `${pair.make.toLowerCase()}|${pair.model.toLowerCase()}`;
    if (uniquePairs.has(key)) {
      continue;
    }

    uniquePairs.add(key);
    deduped.push(pair);
  }

  return deduped.slice(0, 8);
}

function normalizeForCarsXe(payload: NormalizedVehicleImageRequest): NormalizedVehicleImageRequest {
  const normalizedMake = getMakeAliases(payload.make)[0] ?? stripDiacritics(payload.make.trim());
  const normalizedModel = normalizeModelTokens(payload.model, payload.make)[0] ?? stripDiacritics(payload.model.trim());

  return {
    ...payload,
    make: normalizedMake,
    model: normalizedModel
  };
}

function buildCacheKey(payload: NormalizedVehicleImageRequest) {
  return `${payload.make.toLowerCase()}|${payload.model.toLowerCase()}|${payload.year ?? ""}|${payload.color?.toLowerCase() ?? ""}`;
}

function getCachedImage(cacheKey: string) {
  const entry = requestCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    requestCache.delete(cacheKey);
    return null;
  }

  return entry.imageUrl;
}

function setCachedImage(cacheKey: string, imageUrl: string | null) {
  requestCache.set(cacheKey, {
    imageUrl,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function buildCandidates(make: string, model: string, year?: number | null, color?: string | null) {
  const normalizedColor = color?.trim().toLowerCase() || undefined;
  const normalizedYear = year ? String(year) : undefined;
  const pairs = buildSearchPairs(make, model);
  const candidates: Array<Record<string, string>> = [];

  for (const pair of pairs) {
    const base = {
      make: pair.make,
      model: pair.model,
      format: "json",
      transparent: "false"
    };

    if (normalizedYear) {
      candidates.push({ ...base, year: normalizedYear });
      candidates.push({ ...base, year: normalizedYear, angle: "front" });
      candidates.push({ ...base, year: normalizedYear, angle: "side" });
    }

    candidates.push(base);

    if (normalizedColor) {
      candidates.push({ ...base, color: normalizedColor });
    }
  }

  return candidates.slice(0, 24);
}

function selectBestImage(images?: CarsXeImage[]) {
  if (!images?.length) {
    return null;
  }

  const scoreImage = (image: CarsXeImage) => {
    const text = [image.link, image.contextLink, image.hostPageDomainFriendlyName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const width = image.width ?? 0;
    const height = image.height ?? 0;
    const area = width * height;
    const aspectRatio = height > 0 ? width / height : 0;
    let score = Math.min(area / 5000, 1200) + Math.min((image.byteSize ?? 0) / 50000, 250);

    if (aspectRatio >= 1.2 && aspectRatio <= 2.4) {
      score += 500;
    }

    if (image.mime?.includes("png")) {
      score += 120;
    }

    if (positiveKeywords.some((keyword) => text.includes(keyword))) {
      score += 350;
    }

    if (preferredHeroKeywords.some((keyword) => text.includes(keyword))) {
      score += 2200;
    }

    if (text.includes("youtube")) {
      score -= 1800;
    }

    if (rearAngleKeywords.some((keyword) => text.includes(keyword))) {
      score -= 900;
    }

    if (negativeKeywords.some((keyword) => text.includes(keyword))) {
      score -= 3000;
    }

    return score;
  };

  const ranked = [...images].sort((left, right) => scoreImage(right) - scoreImage(left));

  const winner = ranked.find((image) => typeof image.link === "string" && image.link.length > 0);

  return winner?.link ?? null;
}

async function fetchCarsXeImage(apiKey: string, payload: Required<Pick<VehicleImageRequest, "make" | "model">> & VehicleImageRequest) {
  for (const candidate of buildCandidates(payload.make, payload.model, payload.year, payload.color)) {
    const params = new URLSearchParams({ key: apiKey });

    for (const [key, value] of Object.entries(candidate)) {
      if (value) {
        params.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`https://api.carsxe.com/images?${params.toString()}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as CarsXeResponse;
      const bestImage = selectBestImage(data.images);

      if (bestImage) {
        return bestImage;
      }
    } catch {
      // Continue trying less-specific candidates.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  const apiKey = Deno.env.get("CARSXE_API_KEY")?.trim();

  if (!apiKey) {
    return json({
      imageUrl: null,
      provider: null,
      cached: false,
      error: "CARSXE_API_KEY secret is missing."
    });
  }

  let body: VehicleImageRequest;

  try {
    body = (await request.json()) as VehicleImageRequest;
  } catch {
    return json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const normalized = normalizeRequest(body);

  if ("error" in normalized) {
    return json({ error: normalized.error }, { status: 400 });
  }

  const payload = normalizeForCarsXe(normalized.value);
  const cacheKey = buildCacheKey(payload);
  const cachedImageUrl = getCachedImage(cacheKey);

  if (cachedImageUrl !== null) {
    return json({
      imageUrl: cachedImageUrl,
      provider: cachedImageUrl ? "carsxe" : null,
      cached: true
    });
  }

  const imageUrl = await fetchCarsXeImage(apiKey, {
    make: payload.make,
    model: payload.model,
    year: payload.year,
    color: payload.color
  });

  setCachedImage(cacheKey, imageUrl);

  return json({
    imageUrl,
    provider: imageUrl ? "carsxe" : null,
    cached: false
  });
});
