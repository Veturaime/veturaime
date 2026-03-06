import { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { defineConfig, loadEnv, type Plugin, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

type CarsXeImage = {
  link?: string;
  contextLink?: string;
  mime?: string;
  hostPageDomainFriendlyName?: string;
  width?: number;
  height?: number;
  byteSize?: number;
};

type CarsXeResponse = {
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

function createVehicleImageProxy(apiKey: string): Plugin {
  return {
    name: "vehicle-image-proxy",
    configureServer(server) {
      server.middlewares.use("/api/vehicle-image", async (req: IncomingMessage, res: ServerResponse) => {
        const requestUrl = req.url ? new URL(req.url, "http://localhost") : null;

        if (!requestUrl) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid request URL." }));
          return;
        }

        const make = requestUrl.searchParams.get("make")?.trim();
        const model = requestUrl.searchParams.get("model")?.trim();
        const year = requestUrl.searchParams.get("year")?.trim();
        const color = requestUrl.searchParams.get("color")?.trim().toLowerCase();

        if (!make || !model) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Both make and model are required." }));
          return;
        }

        const candidates = [
          { make, model, year },
          { make, model, year, angle: "front" },
          { make, model, year, angle: "side" },
          { make, model },
          { make, model, color },
          { make, model, year, color }
        ];

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

        const selectBestImage = (images?: CarsXeImage[]) => {
          if (!images?.length) {
            return null;
          }

          const ranked = [...images].sort((left, right) => scoreImage(right) - scoreImage(left));

          return ranked.find((image) => typeof image.link === "string" && image.link.length > 0)?.link ?? null;
        };

        for (const candidate of candidates) {
          const params = new URLSearchParams({ key: apiKey, format: "json", transparent: "false" });

          Object.entries(candidate).forEach(([key, value]) => {
            if (value) {
              params.set(key, value);
            }
          });

          try {
            const response = await fetch(`https://api.carsxe.com/images?${params.toString()}`);

            if (!response.ok) {
              continue;
            }

            const payload = (await response.json()) as CarsXeResponse;
            const imageUrl = selectBestImage(payload.images);

            if (imageUrl) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ imageUrl, provider: "carsxe-dev-proxy" }));
              return;
            }
          } catch {
            // Continue trying less-specific candidates.
          }
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ imageUrl: null, provider: null }));
      });

      server.middlewares.use("/api/image-proxy", async (req: IncomingMessage, res: ServerResponse) => {
        const requestUrl = req.url ? new URL(req.url, "http://localhost") : null;
        const sourceUrl = requestUrl?.searchParams.get("src");

        if (!sourceUrl) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing src query param." }));
          return;
        }

        let parsedSource: URL;

        try {
          parsedSource = new URL(sourceUrl);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid source URL." }));
          return;
        }

        if (!["http:", "https:"].includes(parsedSource.protocol)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unsupported protocol." }));
          return;
        }

        try {
          const upstream = await fetch(parsedSource.toString(), {
            headers: {
              "User-Agent": "VeturaIme Local Image Proxy",
              Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
              Referer: "https://www.google.com/"
            }
          });

          if (!upstream.ok || !upstream.body) {
            res.statusCode = upstream.status || 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Failed to fetch upstream image." }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
          res.setHeader("Cache-Control", "public, max-age=3600");

          const arrayBuffer = await upstream.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Image proxy failed." }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const reactPlugin = react();
  const plugins: PluginOption[] = Array.isArray(reactPlugin) ? [...reactPlugin] : [reactPlugin];

  if (env.CARSXE_API_KEY) {
    plugins.push(createVehicleImageProxy(env.CARSXE_API_KEY));
  }

  return {
    plugins
  };
});
