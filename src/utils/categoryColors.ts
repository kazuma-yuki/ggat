import * as api from '../service/api';

export const CUSTOM_SERVICES_STORAGE_KEY = 'custom_service_types';

const FALLBACK_PALETTE = [
  '#14B8A6', '#F43F5E', '#6366F1', '#0EA5E9',
  '#EAB308', '#84CC16', '#F97316', '#06B6D4',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Cache in-memory supaya tidak perlu fetch terus
let colorCache: Array<{ name: string; color: string }> = [];
let cacheLoaded = false;

export async function loadColorCache(): Promise<void> {
  try {
    colorCache = await api.getCategories();
    cacheLoaded = true;
  } catch {
    cacheLoaded = false;
  }
}

export function getCategoryHex(name: string): string {
  const found = colorCache.find((e) => e.name === name);
  if (found) return found.color;
  return FALLBACK_PALETTE[hashName(name) % FALLBACK_PALETTE.length];
}

export async function getCategoryHexAsync(name: string): Promise<string> {
  if (!cacheLoaded) await loadColorCache();
  return getCategoryHex(name);
}

export function getCategoryHexFromStorage(name: string): string | undefined {
  return colorCache.find((e) => e.name === name)?.color;
}

export function getServiceColor(
  svcName: string,
  serviceList?: Array<{ name: string; color?: string }>,
): string {
  if (serviceList) {
    const found = serviceList.find((s) => s.name === svcName);
    if (found?.color) return found.color;
  }
  return getCategoryHex(svcName);
}

export function getAllUsedColors(excludeName?: string, source?: 'category' | 'service'): string[] {
  const colors: string[] = [];
  colorCache.forEach((e) => {
    if (source === 'service' || excludeName === undefined || e.name !== excludeName) {
      colors.push(e.color.toLowerCase());
    }
  });
  try {
    const raw = localStorage.getItem(CUSTOM_SERVICES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{ name: string; color?: string }>;
      parsed.forEach((s) => {
        if (s.color && (source === 'category' || excludeName === undefined || s.name !== excludeName)) {
          colors.push(s.color.toLowerCase());
        }
      });
    }
  } catch { /* ignore */ }
  return [...new Set(colors)];
}