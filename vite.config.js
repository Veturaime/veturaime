var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
var negativeKeywords = [
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
var positiveKeywords = [
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
var preferredHeroKeywords = ["front", "three-quarter", "quarter", "front-three-quarter"];
var rearAngleKeywords = ["rear", "back"];
function createVehicleImageProxy(apiKey) {
    return {
        name: "vehicle-image-proxy",
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use("/api/vehicle-image", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var requestUrl, make, model, year, color, candidates, scoreImage, selectBestImage, _loop_1, _i, candidates_1, candidate, state_1;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            requestUrl = req.url ? new URL(req.url, "http://localhost") : null;
                            if (!requestUrl) {
                                res.statusCode = 400;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ error: "Invalid request URL." }));
                                return [2 /*return*/];
                            }
                            make = (_a = requestUrl.searchParams.get("make")) === null || _a === void 0 ? void 0 : _a.trim();
                            model = (_b = requestUrl.searchParams.get("model")) === null || _b === void 0 ? void 0 : _b.trim();
                            year = (_c = requestUrl.searchParams.get("year")) === null || _c === void 0 ? void 0 : _c.trim();
                            color = (_d = requestUrl.searchParams.get("color")) === null || _d === void 0 ? void 0 : _d.trim().toLowerCase();
                            if (!make || !model) {
                                res.statusCode = 400;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ error: "Both make and model are required." }));
                                return [2 /*return*/];
                            }
                            candidates = [
                                { make: make, model: model, year: year },
                                { make: make, model: model, year: year, angle: "front" },
                                { make: make, model: model, year: year, angle: "side" },
                                { make: make, model: model },
                                { make: make, model: model, color: color },
                                { make: make, model: model, year: year, color: color }
                            ];
                            scoreImage = function (image) {
                                var _a, _b, _c, _d;
                                var text = [image.link, image.contextLink, image.hostPageDomainFriendlyName]
                                    .filter(Boolean)
                                    .join(" ")
                                    .toLowerCase();
                                var width = (_a = image.width) !== null && _a !== void 0 ? _a : 0;
                                var height = (_b = image.height) !== null && _b !== void 0 ? _b : 0;
                                var area = width * height;
                                var aspectRatio = height > 0 ? width / height : 0;
                                var score = Math.min(area / 5000, 1200) + Math.min(((_c = image.byteSize) !== null && _c !== void 0 ? _c : 0) / 50000, 250);
                                if (aspectRatio >= 1.2 && aspectRatio <= 2.4) {
                                    score += 500;
                                }
                                if ((_d = image.mime) === null || _d === void 0 ? void 0 : _d.includes("png")) {
                                    score += 120;
                                }
                                if (positiveKeywords.some(function (keyword) { return text.includes(keyword); })) {
                                    score += 350;
                                }
                                if (preferredHeroKeywords.some(function (keyword) { return text.includes(keyword); })) {
                                    score += 2200;
                                }
                                if (text.includes("youtube")) {
                                    score -= 1800;
                                }
                                if (rearAngleKeywords.some(function (keyword) { return text.includes(keyword); })) {
                                    score -= 900;
                                }
                                if (negativeKeywords.some(function (keyword) { return text.includes(keyword); })) {
                                    score -= 3000;
                                }
                                return score;
                            };
                            selectBestImage = function (images) {
                                var _a, _b;
                                if (!(images === null || images === void 0 ? void 0 : images.length)) {
                                    return null;
                                }
                                var ranked = __spreadArray([], images, true).sort(function (left, right) { return scoreImage(right) - scoreImage(left); });
                                return (_b = (_a = ranked.find(function (image) { return typeof image.link === "string" && image.link.length > 0; })) === null || _a === void 0 ? void 0 : _a.link) !== null && _b !== void 0 ? _b : null;
                            };
                            _loop_1 = function (candidate) {
                                var params, response, payload, imageUrl, _f;
                                return __generator(this, function (_g) {
                                    switch (_g.label) {
                                        case 0:
                                            params = new URLSearchParams({ key: apiKey, format: "json", transparent: "false" });
                                            Object.entries(candidate).forEach(function (_a) {
                                                var key = _a[0], value = _a[1];
                                                if (value) {
                                                    params.set(key, value);
                                                }
                                            });
                                            _g.label = 1;
                                        case 1:
                                            _g.trys.push([1, 4, , 5]);
                                            return [4 /*yield*/, fetch("https://api.carsxe.com/images?".concat(params.toString()))];
                                        case 2:
                                            response = _g.sent();
                                            if (!response.ok) {
                                                return [2 /*return*/, "continue"];
                                            }
                                            return [4 /*yield*/, response.json()];
                                        case 3:
                                            payload = (_g.sent());
                                            imageUrl = selectBestImage(payload.images);
                                            if (imageUrl) {
                                                res.statusCode = 200;
                                                res.setHeader("Content-Type", "application/json");
                                                res.end(JSON.stringify({ imageUrl: imageUrl, provider: "carsxe-dev-proxy" }));
                                                return [2 /*return*/, { value: void 0 }];
                                            }
                                            return [3 /*break*/, 5];
                                        case 4:
                                            _f = _g.sent();
                                            return [3 /*break*/, 5];
                                        case 5: return [2 /*return*/];
                                    }
                                });
                            };
                            _i = 0, candidates_1 = candidates;
                            _e.label = 1;
                        case 1:
                            if (!(_i < candidates_1.length)) return [3 /*break*/, 4];
                            candidate = candidates_1[_i];
                            return [5 /*yield**/, _loop_1(candidate)];
                        case 2:
                            state_1 = _e.sent();
                            if (typeof state_1 === "object")
                                return [2 /*return*/, state_1.value];
                            _e.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4:
                            res.statusCode = 200;
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ imageUrl: null, provider: null }));
                            return [2 /*return*/];
                    }
                });
            }); });
            server.middlewares.use("/api/image-proxy", function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var requestUrl, sourceUrl, parsedSource, upstream, arrayBuffer, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            requestUrl = req.url ? new URL(req.url, "http://localhost") : null;
                            sourceUrl = requestUrl === null || requestUrl === void 0 ? void 0 : requestUrl.searchParams.get("src");
                            if (!sourceUrl) {
                                res.statusCode = 400;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ error: "Missing src query param." }));
                                return [2 /*return*/];
                            }
                            try {
                                parsedSource = new URL(sourceUrl);
                            }
                            catch (_c) {
                                res.statusCode = 400;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ error: "Invalid source URL." }));
                                return [2 /*return*/];
                            }
                            if (!["http:", "https:"].includes(parsedSource.protocol)) {
                                res.statusCode = 400;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ error: "Unsupported protocol." }));
                                return [2 /*return*/];
                            }
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 4, , 5]);
                            return [4 /*yield*/, fetch(parsedSource.toString(), {
                                    headers: {
                                        "User-Agent": "VeturaIme Local Image Proxy",
                                        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                                        Referer: "https://www.google.com/"
                                    }
                                })];
                        case 2:
                            upstream = _b.sent();
                            if (!upstream.ok || !upstream.body) {
                                res.statusCode = upstream.status || 502;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ error: "Failed to fetch upstream image." }));
                                return [2 /*return*/];
                            }
                            res.statusCode = 200;
                            res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
                            res.setHeader("Cache-Control", "public, max-age=3600");
                            return [4 /*yield*/, upstream.arrayBuffer()];
                        case 3:
                            arrayBuffer = _b.sent();
                            res.end(Buffer.from(arrayBuffer));
                            return [3 /*break*/, 5];
                        case 4:
                            _a = _b.sent();
                            res.statusCode = 502;
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ error: "Image proxy failed." }));
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
        }
    };
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var reactPlugin = react();
    var plugins = Array.isArray(reactPlugin) ? __spreadArray([], reactPlugin, true) : [reactPlugin];
    if (env.CARSXE_API_KEY) {
        plugins.push(createVehicleImageProxy(env.CARSXE_API_KEY));
    }
    return {
        plugins: plugins
    };
});
