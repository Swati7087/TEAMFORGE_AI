import axios from "axios";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT (if present) to every outgoing request.
// Flag the request so the response interceptor knows whether to auto-redirect on 401.
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.__hadToken = true;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// On 401, only clear session + redirect if the request was authenticated.
// Prevents a wrong-password login from causing a redirect loop back to /login.
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hadToken = error.config?.__hadToken;
    if (status === 401 && hadToken) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
