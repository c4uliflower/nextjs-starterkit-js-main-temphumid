import axios from "@/lib/axios";
import { TOKEN_KEY } from "../constants";

/**
 * @typedef {Object} JwtPayload
 * @property {number} exp
 * @property {unknown} [key]
 */
// ----------------------------------------------------------------------
/**
 * @param {string} token
 * @returns {JwtPayload | null}
 */
export function jwtDecode(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");

    if (parts.length < 2) {
      throw new Error("Invalid token!");
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64));

    return decoded;
  } catch (error) {
    console.error("Error decoding token:", error);
    throw error;
  }
}
// ----------------------------------------------------------------------
/**
 * @param {string} accessToken
 * @returns {boolean}
 */
export function isValidToken(accessToken) {
  if (!accessToken) {
    return false;
  }
  try {
    const decoded = jwtDecode(accessToken);

    if (!decoded || !("exp" in decoded)) {
      return false;
    }

    const currentTime = Date.now() / 1000;

    return decoded.exp > currentTime;
  } catch (error) {
    console.error("Error during token validation:", error);

    return false;
  }
}
// ----------------------------------------------------------------------
/**
 * @param {number} exp
 * @returns {void}
 */
export function tokenExpired(exp) {
  const currentTime = Date.now();
  const timeLeft = exp * 1000 - currentTime;

  setTimeout(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href =
        process.env.NEXT_PUBLIC_MAT_GALLERY ?? process.env.NEXT_PUBLIC_MAT_GALLERY_URL ?? "";
    } catch (error) {
      console.error("Error during token expiration:", error);
      throw error;
    }
  }, timeLeft);
}
// ----------------------------------------------------------------------
/**
 * @param {string | null} accessToken
 * @returns {Promise<void>}
 */
export async function setSession(accessToken) {
  try {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      const decodedToken = jwtDecode(accessToken);

      if (decodedToken && "exp" in decodedToken) {
        tokenExpired(decodedToken.exp);
      } else {
        throw new Error("Invalid access token!");
      }
    } else {
      localStorage.removeItem(TOKEN_KEY);
      delete axios.defaults.headers.common.Authorization;
    }
  } catch (error) {
    console.error("Error during set session:", error);
    throw error;
  }
}
