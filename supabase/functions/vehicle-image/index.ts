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
  const base = {
    make: make.trim(),
    model: model.trim(),
    format: "json",
    transparent: "false"
  } as const;

  return [
    { ...base, year: normalizedYear },
    { ...base, year: normalizedYear, angle: "front" },
    { ...base, year: normalizedYear, angle: "side" },
    base,
    { ...base, color: normalizedColor },
    { ...base, year: normalizedYear, color: normalizedColor }
  ];
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
    return json({ error: "CARSXE_API_KEY secret is missing." }, { status: 500 });
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

  const payload = normalized.value;
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
