import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { API_BASE_URL } from "../constants/api";
import { loadSession, clearSession } from "../constants/auth";

const { width } = Dimensions.get("window");
const ACCENT = "#009688";

interface Student {
  id: string;
  name: string;
  email?: string;
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

/* ── Student card ── */
function StudentCard({
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
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student.name.charAt(0)}</Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentMeta}>
            {student.grade !== "N/A" ? student.grade : (student.email ?? "N/A")}
            {student.stream ? ` • ${student.stream}` : ""}
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
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

/* ════════════════════════════════════════════ */
/*             TEACHER DASHBOARD               */
/* ════════════════════════════════════════════ */
export default function TeacherDashboard() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherName, setTeacherName] = useState("Teacher");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentId, setNewStudentId] = useState("");
  const [linking, setLinking] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const fetchStudents = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const session = await loadSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setTeacherName(session.name);
      setTeacherId(session.student_id);

      // The real backend endpoint — session.student_id is this teacher's own
      // account id (that's what the login response calls it, for every role).
      const response = await fetch(
        `${API_BASE_URL}/admin/students?teacher_id=${encodeURIComponent(session.student_id)}`
      );

      if (!response.ok) throw new Error("Failed to load students");

      const data = await response.json();
      // The backend only tracks {student_id, name, email} at this endpoint —
      // grade/score/lesson progress aren't available here, so those show as
      // honest placeholders rather than fabricated numbers.
      const mapped: Student[] = (data.students ?? []).map((s: any) => ({
        id: s.student_id,
        name: s.name,
        email: s.email,
        grade: "N/A",
        avgScore: 0,
        lessonsCompleted: 0,
        totalLessons: 1,
        subjects: [],
      }));
      setStudents(mapped);
    } catch (err: any) {
      setError(err.message || "Connection error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
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

  const handleAddStudent = async () => {
    if (!newStudentId.trim()) {
      Alert.alert("Error", "Please enter the student's ID");
      return;
    }
    if (!teacherId) {
      Alert.alert("Error", "Missing teacher session — please re-login");
      return;
    }
    setLinking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/set-teacher-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: newStudentId.trim(),
          teacher_code: teacherId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not link student");

      setModalVisible(false);
      setNewStudentId("");
      Alert.alert("Success", "Student linked to your class.");
      fetchStudents(); // pull the real record from the server
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not link student");
    } finally {
      setLinking(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.includes(search)
  );

  const totalStudents = students.length;
  const avgClassScore = totalStudents > 0
    ? Math.round(students.reduce((sum, s) => sum + s.avgScore, 0) / totalStudents)
    : 0;
  const totalLessonsCompleted = students.reduce((sum, s) => sum + s.lessonsCompleted, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading your students...</Text>
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
            <Text style={styles.greeting}>Hello, {teacherName} 👋</Text>
            <Text style={styles.subtitle}>Track your students' progress</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.7}>
              <View style={[styles.headerAvatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Ionicons name="add" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
              <View style={styles.headerAvatar}>
                <Ionicons name="person" size={22} color={ACCENT} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Add Student Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Link a Student</Text>
            <Text style={{ fontSize: 12, color: "#888", marginBottom: 14, textAlign: "center" }}>
              Enter the student's account ID. They must already have a registered account.
            </Text>
            <TextInput placeholder="Student ID" style={styles.modalInput} value={newStudentId} onChangeText={setNewStudentId} autoCapitalize="none" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#ccc" }]} onPress={() => setModalVisible(false)} disabled={linking}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={handleAddStudent} disabled={linking}>
                {linking ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { color: "#fff" }]}>Link</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchStudents()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content ── */}
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchStudents(true)}
            colors={[ACCENT]}
            tintColor={ACCENT}
          />
        }
        ListHeaderComponent={
          <>
            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <SummaryCard icon="people" value={`${totalStudents}`} label="Students" color={ACCENT} delay={0} />
              <SummaryCard icon="ribbon" value={`${avgClassScore}%`} label="Class Avg" color="#F59E0B" delay={100} />
              <SummaryCard icon="book" value={`${totalLessonsCompleted}`} label="Lessons" color="#6366F1" delay={200} />
            </View>

            {/* Search bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                placeholder="Search by name or ID..."
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Students ({filteredStudents.length})</Text>
              {search.length > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterText}>Filtered</Text>
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <StudentCard
            student={item}
            index={index}
            onPress={() =>
              router.push({
                pathname: "/student/[id]",
                params: { id: item.id, userType: "teacher" },
              })
            }
          />
        )}
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {search.length > 0 ? "No students found" : "No students linked yet"}
              </Text>
              <Text style={styles.emptySubtext}>
                {search.length > 0
                  ? "Try a different search term"
                  : "Students are linked via registration number during signup"}
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

  header: {
    backgroundColor: ACCENT, paddingTop: 54, paddingBottom: 24, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden",
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

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", marginHorizontal: 16, marginTop: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FECACA",
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444" },
  retryText: { fontSize: 13, color: ACCENT, fontWeight: "700" },

  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  summaryCard: {
    width: (width - 48) / 3, backgroundColor: "#fff", borderRadius: 16,
    padding: 12, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  summaryIconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
  summaryLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "500", marginTop: 2 },

  searchContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: "#1F2937" },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  filterBadge: { backgroundColor: `${ACCENT}15`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  filterText: { fontSize: 11, fontWeight: "600", color: ACCENT },

  studentCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: ACCENT, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#fff" },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  studentMeta: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  progressRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#F3F4F6", overflow: "hidden", marginRight: 8 },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: ACCENT },
  progressText: { fontSize: 11, fontWeight: "700", color: "#6B7280", width: 32 },

  rightSection: { alignItems: "center", marginLeft: 8 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  scoreText: { fontSize: 13, fontWeight: "800" },

  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#9CA3AF", marginTop: 4, textAlign: "center", paddingHorizontal: 20 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1F2937", marginBottom: 20, textAlign: "center" },
  modalInput: { backgroundColor: "#F3F4F6", borderRadius: 12, padding: 14, fontSize: 15, color: "#1F2937", marginBottom: 16 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "700", color: "#4B5563" },
});
