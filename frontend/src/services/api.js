import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("MII_AUTH_TOKEN");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("MII_AUTH_TOKEN");
      localStorage.removeItem("MII_AUTH_USER");
      window.location = "/";
    }

    return Promise.reject(error);
  }
);

export function apiAssetUrl(assetPath) {
  if (!assetPath) {
    return "";
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  const normalizedBase = apiBaseUrl.endsWith("/")
    ? apiBaseUrl.slice(0, -1)
    : apiBaseUrl;

  const normalizedPath = assetPath.startsWith("/")
    ? assetPath
    : `/${assetPath}`;

  if (
    normalizedBase &&
    (normalizedPath === normalizedBase ||
      normalizedPath.startsWith(`${normalizedBase}/`))
  ) {
    return normalizedPath;
  }

  return `${normalizedBase}${normalizedPath}`;
}

export default api;
