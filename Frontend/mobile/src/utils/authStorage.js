import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_STORAGE_KEY = "veriwrite_auth_token";
const USER_STORAGE_KEY = "veriwrite_user_profile";

export const saveAuthSession = async (token, user) => {
  if (!token || !user) {
    throw new Error("Invalid authentication session data.");
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    institution: user.institution || "",
  };

  if (Platform.OS === "web") {
    return safeUser;
  }

  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
  await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(safeUser));

  return safeUser;
};

export const getStoredToken = async () => {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    return token && token.trim() ? token.trim() : null;
  } catch (_err) {
    return null;
  }
};

export const getStoredUserProfile = async () => {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const rawUser = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    if (!rawUser) {
      return null;
    }

    const parsed = JSON.parse(rawUser);
    if (
      parsed &&
      parsed.id &&
      parsed.email &&
      (parsed.role === "TEACHER" || parsed.role === "STUDENT")
    ) {
      return parsed;
    }
    return null;
  } catch (_err) {
    return null;
  }
};

/**
 * Deletes the stored JWT and user profile from Expo SecureStore.
 * Note: Deleting the JWT locally clears the device session; it does not revoke a token server-side before its expiry.
 */
export const clearAuthSession = async () => {
  if (Platform.OS === "web") {
    return true;
  }

  const results = await Promise.allSettled([
    SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY),
    SecureStore.deleteItemAsync(USER_STORAGE_KEY),
  ]);

  return results.every((result) => result.status === "fulfilled");
};
