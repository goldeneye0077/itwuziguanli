import type { ApplicationResult } from "../api";

const STORAGE_KEY = "pgc-m02-applications-v1";

function isApplicationResult(value: unknown): value is ApplicationResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as {
    id?: unknown;
    status?: unknown;
    pickupCode?: unknown;
    createdAt?: unknown;
  };
  return (
    typeof candidate.id === "number" &&
    typeof candidate.status === "string" &&
    typeof candidate.pickupCode === "string" &&
    typeof candidate.createdAt === "string"
  );
}

export function readSubmittedApplications(): ApplicationResult[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isApplicationResult);
  } catch {
    return [];
  }
}

export function saveSubmittedApplications(items: ApplicationResult[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
