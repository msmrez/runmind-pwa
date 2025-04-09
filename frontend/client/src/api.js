// src/api.js
import axios from "axios";

const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

const apiClient = axios.create({ baseURL: backendUrl });

// --- Request Interceptor ---
apiClient.interceptors.request.use(
  (config) => {
    // --- CONFIRM KEY IS 'authToken' ---
    const token = localStorage.getItem("authToken");

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
      // console.log("[Axios Interceptor] Token found, adding header."); // Optional log
    } else {
      // console.log("[Axios Interceptor] No token found.");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Response Interceptor ---
apiClient.interceptors.response.use(
  (response) => {
    return response;
  }, // Pass through successful responses
  (error) => {
    console.error(
      "[Axios Interceptor] Response error Status:",
      error.response?.status
    );
    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      console.log(
        "[Axios Interceptor] Unauthorized/Forbidden response. Clearing token/user, redirecting."
      );
      // --- CONFIRM KEYS ARE 'authToken' and 'stravaAthlete' ---
      localStorage.removeItem("authToken");
      localStorage.removeItem("stravaAthlete"); // Clear user info too

      // Redirect only if not already on a public page like home/login/register
      if (!["/", "/login", "/register"].includes(window.location.pathname)) {
        window.location.href = "/login"; // Redirect to login on auth error
      }
    }
    return Promise.reject(error); // Reject promise for component's catch block
  }
);

export default apiClient;
