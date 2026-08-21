import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4100/api",
  withCredentials: true,
});

let accessToken: string | null = null;

export function definirAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Rafraîchissement automatique du jeton d'accès via le cookie de session (F-02 / section 10 du CDC).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requeteOriginale = error.config;
    const estAppelAuth =
      requeteOriginale?.url?.includes("/auth/refresh") || requeteOriginale?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !requeteOriginale._retry && !estAppelAuth) {
      requeteOriginale._retry = true;
      try {
        const { data } = await api.post("/auth/refresh");
        definirAccessToken(data.accessToken);
        requeteOriginale.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(requeteOriginale);
      } catch {
        definirAccessToken(null);
      }
    }
    return Promise.reject(error);
  }
);

export function messageErreur(err: unknown, repli = "Une erreur est survenue."): string {
  if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === "object") {
    const data = err.response.data as { message?: string };
    if (data.message) return data.message;
  }
  return repli;
}
