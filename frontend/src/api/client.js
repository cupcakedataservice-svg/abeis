import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "https://abeis-backend.onrender.com",
});

// Attach the admin JWT (stored in sessionStorage) to every request automatically.
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("abeis_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
