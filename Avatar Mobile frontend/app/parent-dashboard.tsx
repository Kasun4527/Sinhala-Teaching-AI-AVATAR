import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { API_BASE_URL } from "../constants/api";
import { loadSession, clearSession } from "../constants/auth";
import { getChildren } from "../constants/parentChildren";

const { width } = Dimensions.get("window");
const PARENT_ACCENT = "#009688";

interface Student {
  id: string;
  name: string;
  grade: string;
  stream?: string;
  avgScore: number;
  lessonsCompleted: number;
  totalLessons: number;
  subjects: any[];
}

/* ── Summary stat chip ── */
function SummaryCard({
  icon, value, label, color, delay = 0,
}: {
  icon: string; value: string; label: string; color: string; delay?: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.summaryCard, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <View style={[styles.summaryIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </Animated.View>
  );
}

/* ── Child card ── */
function ChildCard({
  student, index, onPress,
}: {
  student: Student; index: number; onPress: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const progressPct = student.totalLessons > 0
    ? Math.round((student.lessonsCompleted / student.totalLessons) * 100)
    : 0;
  const scoreColor =
    student.avgScore >= 85 ? "#14B8A6" : student.avgScore >= 75 ? "#F59E0B" : "#EF4444";

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <TouchableOpacity style={styles.studentCard} activeOpacity={0.7} onPress={onPress}>
        <View style={[styles.avatar, { backgroundColor: PARENT_ACCENT }]}>
          <Text style={styles.avatarText}>{student.name.charAt(0)}</Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentMeta}>
            {student.grade}{student.stream ? ` • ${student.stream}` : ""}
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: PARENT_ACCENT }]} />
            </View>
            <Text style={styles.progressText}>{progressPct}%</Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <View style={[styles.scoreBadge, { backgroundColor: `${scoreColor}15` }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>{student.avgScore}%</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" style={{ marginTop: 8 }} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ── Assemble one child's real progress from existing endpoints ──
 * Grade still has no backend field anywhere (shows "N/A" everywhere,
 * including the teacher dashboard) — but the name is now resolved via
 * /admin/student-lookup. */
async function fetchChildProgress(studentId: string): Promise<Student> {
  const subjectsResp = await fetch(
    `${API_BASE_URL}/admin/student-subjects?student_id=${encodeURIComponent(studentId)}`
  );
  if (!subjectsResp.ok) throw new Error(`No data found for student ID ${studentId}`);
  const { subjects: subjectNames } = await subjectsResp.json();

  let studentName = `Student ${studentId.slice(-6)}`;
  try {
    const lookupResp = await fetch(
      `${API_BASE_URL}/admin/student-lookup?student_id=${encodeURIComponent(studentId)}`
    );
    if (lookupResp.ok) {
      const { name } = await lookupResp.json();
      if (name) studentName = name;
    }
  } catch {
    // Keep the id-based fallback name if the lookup fails.
  }

  let totalLessons = 0;
  let lessonsCompleted = 0;
  const scores: number[] = [];

  for (const subject of subjectNames ?? []) {
    try {
      const progressResp = await fetch(
        `${API_BASE_URL}/admin/lesson-progress?student_id=${encodeURIComponent(studentId)}&subject=${encodeURIComponent(subject)}`
      );
      if (!progressResp.ok) continue;
      const progress = await progressResp.json();
      totalLessons += progress.total_lessons ?? 0;
      lessonsCompleted += progress.completed_lessons ?? 0;
      if (typeof progress.percentage === "number") scores.push(progress.percentage);
    } catch {
      // Skip a subject that fails — the rest of the child's data still shows.
    }
  }

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return {
    id: studentId,
    name: studentName,
    grade: "N/A",
    avgScore,
    lessonsCompleted,
    totalLessons: Math.max(totalLessons, 1),
    subjects: subjectNames ?? [],
  };
}

/* ════════════════════════════════════════════ */
/*             PARENT DASHBOARD                */
/* ════════════════════════════════════════════ */
export default function ParentDashboard() {
  const router = useRouter();
  const [children, setChildren] = useState<Student[]>([]);
  const [parentName, setParentName] = useState("Parent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [parentId, setParentId] = useState("");

  const fetchChildren = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const session = await loadSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setParentName(session.name);
      const sid = session.student_id;
      setParentId(sid);

      // Fetch children from backend (replaces on-device storage)
      let childIds: string[] = [];
      try {
        const backendResp = await fetch(
          `${API_BASE_URL}/parent/children?parent_id=${encodeURIComponent(sid)}`
        );
        if (backendResp.ok) {
          const backendData = await backendResp.json();
          childIds = (backendData.children || []).map((c: any) => c.student_id);
        }
      } catch {
        // Fallback to on-device storage if backend fails
        childIds = await getChildren(session.email);
      }

      const results = await Promise.allSettled(childIds.map(fetchChildProgress));
      const mapped = results
        .filter((r): r is PromiseFulfilledResult<Student> => r.status === "fulfilled")
        .map((r) => r.value);

      const failedCount = results.length - mapped.length;
      if (failedCount > 0 && mapped.length === 0) {
        throw new Error("Could not load any linked children's data");
      }
      setChildren(mapped);

      // Fetch alerts (teacher messages)
      try {
        const alertResp = await fetch(
          `${API_BASE_URL}/notifications?user_id=${encodeURIComponent(sid)}&type=parent_message&limit=20`
        );
        if (alertResp.ok) {
          const alertData = await alertResp.json();
          setAlerts(alertData.notifications || []);
        }
      } catch {}

    } catch (err: any) {
      setError(err.message || "Connection error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Re-fetch every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchChildren();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: "destructive", onPress: async () => {
          await clearSession();
          router.replace("/login");
        }
      },
    ]);
  };

  // Derived stats
  const totalChildren = children.length;
  const avgScore = totalChildren > 0
    ? Math.round(children.reduce((s, c) => s + c.avgScore, 0) / totalChildren)
    : 0;
  const totalLessons = children.reduce((s, c) => s + c.lessonsCompleted, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PARENT_ACCENT} />
        <Text style={styles.loadingText}>Loading your children's progress...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Hello, {parentName} 👋</Text>
            <Text style={styles.subtitle}>Here is how your children are doing</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
            <View style={styles.headerAvatar}>
              <Ionicons name="person" size={22} color={PARENT_ACCENT} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Error banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchChildren()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={children}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchChildren(true)}
            colors={[PARENT_ACCENT]}
            tintColor={PARENT_ACCENT}
          />
        }
        ListHeaderComponent={
          <>
            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <SummaryCard icon="people" value={`${totalChildren}`} label="Children" color={PARENT_ACCENT} delay={0} />
              <SummaryCard icon="ribbon" value={`${avgScore}%`} label="Avg Score" color="#F59E0B" delay={100} />
              <SummaryCard icon="book" value={`${totalLessons}`} label="Lessons" color="#6366F1" delay={200} />
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Children ({totalChildren})</Text>
            </View>

            {/* Alerts from Teachers */}
            {alerts.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowAlerts(!showAlerts)}
                activeOpacity={0.7}
                style={{
                  marginHorizontal: 16, marginBottom: 12, padding: 14,
                  backgroundColor: "white", borderRadius: 14,
                  borderWidth: 1, borderColor: "#EF444433",
                  shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="notifications" size={18} color="#EF4444" />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>
                      Teacher Alerts ({alerts.filter((a: any) => !a.read).length} new)
                    </Text>
                  </View>
                  <Ionicons name={showAlerts ? "chevron-up" : "chevron-down"} size={18} color="#94A3B8" />
                </View>
                {showAlerts && (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {alerts.map((alert: any) => (
                      <View
                        key={alert.id}
                        style={{
                          padding: 12, borderRadius: 10,
                          backgroundColor: alert.read ? "#F8FAFC" : "#EFF6FF",
                          borderWidth: 1, borderColor: alert.read ? "#E2E8F0" : "#BFDBFE",
                        }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>
                            {alert.sender_name || "Teacher"}
                          </Text>
                          <Text style={{ fontSize: 10, color: "#94A3B8" }}>
                            {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : ""}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, color: "#475569", lineHeight: 18 }}>{alert.message}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <ChildCard
            student={item}
            index={index}
            onPress={() =>
              router.push({
                pathname: "/student/[id]",
                params: { id: item.id, userType: "parent" },
              })
            }
          />
        )}
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No children linked yet</Text>
              <Text style={styles.emptySubtext}>
                Link your children using their Student Code (e.g. ST123456) during signup
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

/* ═══════════════════ STYLES ═══════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F2F5" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F0F2F5" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7280" },

  /* Header */
  header: {
    backgroundColor: PARENT_ACCENT,
    paddingTop: 54, paddingBottom: 24, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: "hidden", marginBottom: 4,
  },
  decorCircle1: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)", top: -20, right: -20,
  },
  decorCircle2: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.06)", bottom: -15, left: -15,
  },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },

  /* Error banner */
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", marginHorizontal: 16, marginTop: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FECACA",
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444" },
  retryText: { fontSize: 13, color: PARENT_ACCENT, fontWeight: "700" },

  /* List */
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30 },

  /* Summary row */
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  summaryCard: {
    width: (width - 48) / 3, backgroundColor: "#fff", borderRadius: 16,
    padding: 12, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  summaryIconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
  summaryLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "500", marginTop: 2 },

  /* Section header */
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937" },

  /* Student card */
  studentCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#fff" },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  studentMeta: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  /* Progress bar */
  progressRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F3F4F6", overflow: "hidden", marginRight: 8 },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: "700", color: "#6B7280", width: 32 },

  /* Right section */
  rightSection: { alignItems: "center", marginLeft: 8 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  scoreText: { fontSize: 13, fontWeight: "800" },

  /* Empty state */
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#9CA3AF", marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
});
