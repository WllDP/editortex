import type { UploadMode } from "@/types/document";
import type { UploadedLatexProject, UploadedTemplateSourceType } from "@/types/latex";

const RECENT_TEMPLATES_STORAGE_KEY = "editortex:recent-templates";
const RECENT_TEMPLATES_UPDATED_EVENT = "editortex:recent-templates-updated";
const RECENT_TEMPLATES_LIMIT = 3;
const RECENT_TEMPLATES_DB_NAME = "editortex-template-cache";
const RECENT_TEMPLATES_DB_VERSION = 1;
const RECENT_TEMPLATES_STORE_NAME = "recent-template-payloads";

export type RecentTemplate = {
  fileName: string;
  name: string;
  mode: UploadMode;
  sourceType: UploadedTemplateSourceType;
  usedAt: string;
};

export type RecentTemplatePayload = {
  fileName: string;
  content: string;
  project: UploadedLatexProject;
  mode: UploadMode;
};

export function getRecentTemplates(): RecentTemplate[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(RECENT_TEMPLATES_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isRecentTemplate).map(toRecentTemplate).slice(0, RECENT_TEMPLATES_LIMIT);
  } catch {
    return [];
  }
}

export function saveRecentTemplate(template: Omit<RecentTemplate, "usedAt"> & RecentTemplatePayload) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedFileName = template.fileName.trim();
  if (!normalizedFileName) {
    return;
  }

  const nextTemplate: RecentTemplate = {
    fileName: normalizedFileName,
    name: template.name.trim() || normalizedFileName,
    mode: template.mode,
    sourceType: template.sourceType,
    usedAt: new Date().toISOString(),
  };
  const existingTemplates = getRecentTemplates().filter(
    (candidate) => candidate.fileName.toLowerCase() !== nextTemplate.fileName.toLowerCase(),
  );
  const nextTemplates = [nextTemplate, ...existingTemplates].slice(0, RECENT_TEMPLATES_LIMIT);

  try {
    window.localStorage.setItem(RECENT_TEMPLATES_STORAGE_KEY, JSON.stringify(nextTemplates));
    void saveRecentTemplatePayload({
      fileName: normalizedFileName,
      content: template.content,
      project: template.project,
      mode: template.mode,
    }).catch(() => undefined);
    void pruneRecentTemplatePayloads(nextTemplates.map((candidate) => candidate.fileName)).catch(() => undefined);
    window.dispatchEvent(new CustomEvent(RECENT_TEMPLATES_UPDATED_EVENT));
  } catch {
    window.localStorage.removeItem(RECENT_TEMPLATES_STORAGE_KEY);
  }
}

export async function getRecentTemplatePayload(fileName: string): Promise<RecentTemplatePayload | undefined> {
  if (typeof indexedDB === "undefined") {
    return undefined;
  }

  const database = await openRecentTemplatesDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECENT_TEMPLATES_STORE_NAME, "readonly");
    const request = transaction.objectStore(RECENT_TEMPLATES_STORE_NAME).get(normalizeTemplateKey(fileName));

    request.onsuccess = () => resolve(isRecentTemplatePayload(request.result) ? request.result : undefined);
    request.onerror = () => reject(request.error);
  });
}

export function subscribeToRecentTemplates(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === RECENT_TEMPLATES_STORAGE_KEY) {
      callback();
    }
  }

  window.addEventListener(RECENT_TEMPLATES_UPDATED_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(RECENT_TEMPLATES_UPDATED_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function isRecentTemplate(value: unknown): value is RecentTemplate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RecentTemplate>;
  return (
    typeof candidate.fileName === "string" &&
    typeof candidate.name === "string" &&
    (candidate.mode === "import-document" || candidate.mode === "template-only") &&
    (candidate.sourceType === "tex-file" || candidate.sourceType === "overleaf-zip") &&
    typeof candidate.usedAt === "string"
  );
}

function isRecentTemplatePayload(value: unknown): value is RecentTemplatePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RecentTemplatePayload>;
  return (
    typeof candidate.fileName === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.project === "object" &&
    (candidate.mode === "import-document" || candidate.mode === "template-only")
  );
}

function toRecentTemplate(template: RecentTemplate): RecentTemplate {
  return {
    fileName: template.fileName,
    name: template.name,
    mode: template.mode,
    sourceType: template.sourceType,
    usedAt: template.usedAt,
  };
}

async function saveRecentTemplatePayload(payload: RecentTemplatePayload) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const database = await openRecentTemplatesDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(RECENT_TEMPLATES_STORE_NAME, "readwrite");
    const request = transaction
      .objectStore(RECENT_TEMPLATES_STORE_NAME)
      .put(payload, normalizeTemplateKey(payload.fileName));

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function pruneRecentTemplatePayloads(allowedFileNames: string[]) {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const allowedKeys = new Set(allowedFileNames.map(normalizeTemplateKey));
  const database = await openRecentTemplatesDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(RECENT_TEMPLATES_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RECENT_TEMPLATES_STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      for (const key of request.result) {
        if (typeof key === "string" && !allowedKeys.has(key)) {
          store.delete(key);
        }
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

function openRecentTemplatesDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(RECENT_TEMPLATES_DB_NAME, RECENT_TEMPLATES_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECENT_TEMPLATES_STORE_NAME)) {
        database.createObjectStore(RECENT_TEMPLATES_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function normalizeTemplateKey(fileName: string) {
  return fileName.trim().toLowerCase();
}
