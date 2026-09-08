import { create } from "zustand";

const STORAGE_KEY = "comis_auth_session";

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const produce = data.produceName || data.businessName || data.stationName || "Kenema Produce";
      return {
        token: data.token || null,
        role: data.role || null,
        name: data.name || "",
        userId: data.userId || null,
        produceName: produce,
        stationName: produce,
      };
    }
  } catch (e) {
    console.error("Failed to load auth session", e);
  }
  return {
    token: null,
    role: null,
    name: "",
    userId: null,
    produceName: "Kenema Produce",
    stationName: "Kenema Station",
  };
}

export const useAuthStore = create((set) => ({
  ...loadInitialState(),

  login: ({ token, role, name, userId, stationName, businessName, produceName }) => {
    const resolvedProduce = produceName || businessName || stationName || "COMIS Produce";
    const session = {
      token,
      role,
      name: name || "Staff",
      userId,
      produceName: resolvedProduce,
      stationName: resolvedProduce,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error("Failed to save auth session", e);
    }
    set(session);
  },

  updateProfile: ({ name, stationName, produceName }) => {
    set((state) => {
      const resolved = produceName || stationName;
      const updated = {
        ...state,
        ...(name ? { name } : {}),
        ...(resolved ? { produceName: resolved, stationName: resolved } : {}),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to update auth session", e);
      }
      return updated;
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear auth session", e);
    }
    set({
      token: null,
      role: null,
      name: "",
      userId: null,
      produceName: "",
      stationName: "",
    });
  },
}));

