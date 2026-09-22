import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The backend has no parent↔child data model at all — no field to store
 * which students belong to a parent, no endpoint to query it. So unlike
 * teacher→student linking (which rides on the real /auth/set-teacher-code
 * endpoint), this is stored entirely on-device: the student IDs a parent
 * enters at signup are kept here, keyed by the parent's email, and read
 * back every time the parent dashboard loads.
 *
 * Because there's no backend record of these either, we can only fetch
 * each child's real *progress* data (student-subjects / lesson-progress —
 * both accept a raw student_id with no backend-side ownership check).
 * There's no endpoint to look up a student's name/grade by id, so the
 * dashboard falls back to showing the id itself.
 */
const CHILDREN_KEY = "avatar_parent_children";

type ChildrenMap = Record<string, string[]>;

async function readAll(): Promise<ChildrenMap> {
  try {
    const raw = await AsyncStorage.getItem(CHILDREN_KEY);
    return raw ? (JSON.parse(raw) as ChildrenMap) : {};
  } catch {
    return {};
  }
}

/** Save/replace the list of child student IDs for a parent (by email). */
export async function saveChildren(email: string, studentIds: string[]): Promise<void> {
  try {
    const all = await readAll();
    all[email] = studentIds;
    await AsyncStorage.setItem(CHILDREN_KEY, JSON.stringify(all));
  } catch (error) {
    console.error("Failed to save parent's children:", error);
  }
}

/** Read the stored list of child student IDs for a parent (by email). */
export async function getChildren(email: string): Promise<string[]> {
  try {
    const all = await readAll();
    return all[email] ?? [];
  } catch (error) {
    console.error("Failed to read parent's children:", error);
    return [];
  }
}
