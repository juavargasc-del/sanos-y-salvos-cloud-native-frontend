import axios from "axios";

import { loginRequest, msalInstance } from "../authConfig";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];

    if (!account) {
      return config;
    }

    const tokenResponse = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    config.headers.Authorization = `Bearer ${tokenResponse.accessToken}`;

    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
