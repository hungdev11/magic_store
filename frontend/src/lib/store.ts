import { create } from "zustand";
import { api, StoreSetting, UpdateSettingsInput } from "./api";

export interface StoreProfileState {
  storeSetting: StoreSetting | null;
  enabledModules: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (data: UpdateSettingsInput) => Promise<void>;
  applyPreset: (preset: "SEAFOOD" | "APPAREL" | "FOOD") => Promise<void>;
  setModule: (moduleKey: string, enabled: boolean) => Promise<void>;
  isModuleEnabled: (moduleKey: string) => boolean;
}

function parseModules(raw: string | Record<string, boolean> | undefined | null): Record<string, boolean> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const useStoreProfile = create<StoreProfileState>((set, get) => ({
  storeSetting: null,
  enabledModules: {},
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const setting = await api.getSettings();
      const enabledModules = parseModules(setting.enabled_modules);
      set({ storeSetting: setting, enabledModules, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || "Không thể tải cấu hình cửa hàng", isLoading: false });
    }
  },

  updateSettings: async (data: UpdateSettingsInput) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateSettings(data);
      const enabledModules = parseModules(updated.enabled_modules);
      set({ storeSetting: updated, enabledModules, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || "Lỗi khi cập nhật cấu hình", isLoading: false });
      throw err;
    }
  },

  applyPreset: async (preset: "SEAFOOD" | "APPAREL" | "FOOD") => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.applyPreset(preset);
      const enabledModules = parseModules(updated.enabled_modules);
      set({ storeSetting: updated, enabledModules, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || "Lỗi khi áp dụng mẫu ngành hàng", isLoading: false });
      throw err;
    }
  },

  setModule: async (moduleKey: string, enabled: boolean) => {
    const current = get().enabledModules;
    const nextModules = { ...current, [moduleKey]: enabled };
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateSettings({
        enabled_modules: nextModules,
      });
      const parsed = parseModules(updated.enabled_modules);
      set({ storeSetting: updated, enabledModules: parsed, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || "Lỗi khi cập nhật module", isLoading: false });
      throw err;
    }
  },

  isModuleEnabled: (moduleKey: string) => {
    return !!get().enabledModules[moduleKey];
  },
}));
