const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function validateVehicleUploadFile(file: File, label: "Dokumenti" | "Kuponi") {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`${label} është shumë i madh (maksimumi 10MB).`);
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.type)) {
    throw new Error(`${label} duhet të jetë PDF, JPG, PNG ose WEBP.`);
  }
}

export function ensureValidDateInput(value: string, errorMessage: string) {
  if (!value.trim()) {
    throw new Error(errorMessage);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(errorMessage);
  }
}

export function ensurePositiveAmount(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Shuma duhet të jetë më e madhe se 0.");
  }

  return parsed;
}

export function ensureNonNegativeNumber(value: string, errorMessage: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(errorMessage);
  }

  return parsed;
}
