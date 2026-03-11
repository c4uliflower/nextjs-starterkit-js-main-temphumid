import Axios from "axios";
import { TOKEN_KEY } from "./constants";
/** @type {import("axios").AxiosInstance} */
const axios = Axios.create({
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  baseURL: process.env.NEXT_PUBLIC_BACKEND_API,
});

axios.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 && typeof window !== "undefined") {
      const ssoLogin =
        process.env.NEXT_PUBLIC_MAT_GALLERY ??
        process.env.NEXT_PUBLIC_MAT_GALLERY_URL ??
        "https://192.168.1.100:1000/";

      window.location.href = ssoLogin;
    }

    return Promise.reject(error);
  },
);
export default axios;
