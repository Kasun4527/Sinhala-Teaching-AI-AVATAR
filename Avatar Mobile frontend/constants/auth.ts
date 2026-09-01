import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "avatar_auth_session";

export interface AuthSession {
  token: string;
  role: "parent" | "teacher" | "student" | string;
  name: string;
  email: string;
  student_id: string;
  associated_students: string[];
}

/** Save session after successful login */
export async function saveSession(session: AuthSession): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Failed to save session:", error);
    throw new Error("Storage unavailable. Please try again.");
  }
}

/** Load saved session (returns null if not logged in) */
export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch (error) {
    console.error("Failed to load session:", error);
    return null;
  }
}

/** Clear session on logout */
export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_KEY);
  } catch (error) {
    console.error("Failed to clear session:", error);
  }
}