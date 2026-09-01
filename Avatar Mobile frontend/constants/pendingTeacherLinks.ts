import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The backend's /auth/signup doesn't return the new account's own id, and
 * /auth/login refuses unverified accounts — so a teacher who enters student
 * IDs at signup can't be linked to them (via /auth/set-teacher-code) until
 * their FIRST successful login, once we finally know their own id.
 *
 * This just bridges that gap locally: signup stashes the entered student
 * IDs keyed by email, and login consumes + clears them once it has the
 * teacher's own id.
 */
const PENDING_KEY = "avatar_pending_teacher_links";

type PendingMap = Record<string, string[]>;

async function readAll(): Promise<PendingMap> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingMap) : {};
  } catch {
    return {};
  }
}

export async function savePendingLinks(email: string, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    const all = await readAll();
    all[email] = studentIds;
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(all));
  } catch (error) {
    console.error("Failed to save pending teacher links:", error);
  }
}

export async function takePendingLinks(email: string): Promise<string[]> {
  try {
    const all = await readAll();
    const ids = all[email] ?? [];
    if (ids.length > 0) {
      delete all[email];
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(all));
    }
    return ids;
  } catch (error) {
    console.error("Failed to read pending teacher links:", error);
    return [];
  }
}
