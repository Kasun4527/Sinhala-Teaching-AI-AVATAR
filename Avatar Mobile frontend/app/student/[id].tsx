import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../../constants/api";

const { width } = Dimensions.get("window");
const ACCENT = "#009688";

/* ── Per-subject detail type ── */
interface SubjectDetail {
  name: string;
  color: string;
  totalLessons: number;
  completedLessons: number;
  quizzesTaken: number;
  avgWatchTime: number;
  lastActivity: string;
}

/* ── Student type ── */
interface StudentData {
  name: string;
  grade: string;
  stream?: string;
  totalLessons: number;
  completedLessons: number;
  avgWatchTime: number;
  attendance: number;
  ranking: number;
  recentActivity: { label: string; date: string; icon: string }[];
  subjects: SubjectDetail[];
}

/** Map API topic records (already tagged with their subject) → SubjectDetail[] */
function buildSubjectDetails(topics: any[]): SubjectDetail[] {
  const COLORS = ["#6366F1", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
  const map: Record<string, SubjectDetail> = {};

  topics.forEach((t: any) => {
    const subjectName = t.subject || t.lesson || "Unknown";
    if (!map[subjectName]) {
      map[subjectName] = {
        name: subjectName,
        color: COLORS[Object.keys(map).length % COLORS.length],
        totalLessons: 0,
        completedLessons: 0,
        quizzesTaken: 0,
        avgWatchTime: 0,
        lastActivity: "",
      };
    }
    const s = map[subjectName];
    s.totalLessons += 1;
    if (t.topic_unlocked) s.completedLessons += 1;
    if (t.final_quiz_marks != null) s.quizzesTaken += 1;
  });

  return Object.values(map);
}

/* ════════════════════════════════════════════ */

/* ── Stat mini-card ── */
function StatCard({
  icon,
  value,
  label,
  color,
  delay = 0,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
  delay?: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.statCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

/* ════════════════════════════════════════════ */
/*              MAIN DETAIL SCREEN             */
/* ════════════════════════════════════════════ */
export default function StudentDetail() {
  const { id, userType } = useLocalSearchParams();
  const router = useRouter();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* No "All" option — always viewing one subject's stats. Defaults to
     the first subject once the student's data loads (see effect below). */
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  // Raw per-topic records (each tagged with its subject) — powers the
  // expandable Topic Details list below, mirroring the web admin dashboard.
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [improvement, setImprovement] = useState<any | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [engagementData, setEngagementData] = useState<Record<string, any[]>>({});
  const [qaData, setQaData] = useState<Record<string, any[]>>({});
  const [youtubeData, setYoutubeData] = useState<Record<string, any[]>>({});
  const [loadingExtrasKey, setLoadingExtrasKey] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  const topicKey = (t: any) => `${t.subject}|${t.lesson}|${t.topic}`;

  // Lazy-load a topic's engagement sessions / Q&A / YouTube history —
  // fetched only once per topic, the first time it's expanded (same
  // real endpoints the web admin dashboard already uses).
  const fetchTopicExtras = async (t: any) => {
    const key = topicKey(t);
    if (engagementData[key] || qaData[key] || youtubeData[key]) return;
    setLoadingExtrasKey(key);
    try {
      const studentId = String(id);
      const params = `student_id=${encodeURIComponent(studentId)}&subject=${encodeURIComponent(t.subject)}&topic=${encodeURIComponent(t.topic)}`;
      const [engResp, qaResp, ytResp] = await Promise.all([
        fetch(`${API_BASE_URL}/engagement-history?${params}`).catch(() => null),
        fetch(`${API_BASE_URL}/admin/student-qa?${params}`).catch(() => null),
        fetch(`${API_BASE_URL}/admin/youtube-history?${params}`).catch(() => null),
      ]);
      if (engResp?.ok) {
        const data = await engResp.json();
        setEngagementData((prev) => ({ ...prev, [key]: data.sessions ?? [] }));
      }
      if (qaResp?.ok) {
        const data = await qaResp.json();
        setQaData((prev) => ({ ...prev, [key]: data.qa ?? [] }));
      }
      if (ytResp?.ok) {
        const data = await ytResp.json();
        setYoutubeData((prev) => ({ ...prev, [key]: data.sessions ?? [] }));
      }
    } finally {
      setLoadingExtrasKey(null);
    }
  };

  const toggleTopic = (t: any) => {
    const key = topicKey(t);
    if (expandedTopic === key) {
      setExpandedTopic(null);
    } else {
      setExpandedTopic(key);
      fetchTopicExtras(t);
    }
  };

  // Fetch real student data from backend — there's no single "student
  // detail" endpoint, so this assembles it from the same real endpoints
  // the teacher/parent dashboards use: subjects, then per-subject topic
  // details (which carry both pre-quiz and post-quiz marks), plus a name
  // lookup.
  //
  // Wrapped as a reusable callback (not a plain effect) because expo-router
  // keeps this screen mounted when you navigate away and back — a plain
  // useEffect keyed on `id` would never re-run, so a just-completed post
  // quiz (done elsewhere, e.g. the web app) wouldn't show as "completed"
  // until the app was fully restarted. useFocusEffect below re-runs this
  // every time the screen regains focus, and pull-to-refresh calls it too.
  const fetchStudentDetail = useCallback(async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoadingStudent(true);
      try {
        const studentId = String(id);

        const subjectsResp = await fetch(
          `${API_BASE_URL}/admin/student-subjects?student_id=${encodeURIComponent(studentId)}`
        );
        if (!subjectsResp.ok) throw new Error("Failed to load student data");
        const { subjects: subjectNames } = await subjectsResp.json();

        const topicsPerSubject = await Promise.all(
          (subjectNames ?? []).map(async (subject: string) => {
            try {
              const resp = await fetch(
                `${API_BASE_URL}/admin/topic-details?student_id=${encodeURIComponent(studentId)}&subject=${encodeURIComponent(subject)}`
              );
              if (!resp.ok) return [];
              const { topics } = await resp.json();
              // topic-details doesn't echo the subject name back per-topic —
              // tag it so buildSubjectDetails can group correctly.
              return (topics ?? []).map((t: any) => ({ ...t, subject }));
            } catch {
              return [];
            }
          })
        );
        const allTopics = topicsPerSubject.flat();
        setAllTopics(allTopics);

        let studentName = "Student";
        try {
          const lookupResp = await fetch(
            `${API_BASE_URL}/admin/student-lookup?student_id=${encodeURIComponent(studentId)}`
          );
          if (lookupResp.ok) {
            const { name } = await lookupResp.json();
            if (name) studentName = name;
          }
        } catch {
          // Keep the generic fallback name if the lookup fails.
        }

        const subjects = buildSubjectDetails(allTopics);
        const totalLessons = Math.max(subjects.reduce((s: number, x: SubjectDetail) => s + x.totalLessons, 0), 1);
        const completedLessons = subjects.reduce((s: number, x: SubjectDetail) => s + x.completedLessons, 0);

        setStudent({
          name: studentName,
          grade: "N/A",
          totalLessons,
          completedLessons,
          avgWatchTime: 0,
          attendance: 0,
          ranking: 0,
          recentActivity: allTopics.slice(0, 3).map((t: any) => ({
            label: `${t.topic} (${t.lesson})`,
            date: "",
            icon: "book",
          })),
          subjects,
        });
      } catch (err: any) {
        setFetchError(err.message || "Connection error");
      } finally {
        setLoadingStudent(false);
        setRefreshing(false);
      }
    }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchStudentDetail();
    }, [fetchStudentDetail])
  );

  // Improvement trend (pre-quiz → post-quiz) — overall, or scoped to
  // whichever subject chip is selected. Same /progress-improvement
  // endpoint the web admin dashboard already uses. Re-runs on subject
  // change AND every time the screen regains focus (see fetchStudentDetail
  // above for why a focus-based refetch matters here).
  const fetchImprovement = useCallback(async () => {
    if (!selectedSubject) return; // nothing picked yet
    try {
      const studentId = String(id);
      const url = `${API_BASE_URL}/progress-improvement?student_id=${encodeURIComponent(studentId)}&subject=${encodeURIComponent(selectedSubject)}`;
      const resp = await fetch(url);
      if (resp.ok) setImprovement(await resp.json());
    } catch {
      // Leave whatever improvement data is already showing.
    }
  }, [id, selectedSubject]);

  useEffect(() => {
    fetchImprovement();
  }, [fetchImprovement]);

  useFocusEffect(
    useCallback(() => {
      fetchImprovement();
    }, [fetchImprovement])
  );

  // No "All" tab — auto-pick a subject once data loads. Re-runs whenever
  // the subject list changes (e.g. after a refresh) so the selection stays
  // valid; only resets it if the current pick no longer exists.
  useEffect(() => {
    if (!student) return;
    const stillValid = student.subjects.some((s) => s.name === selectedSubject);
    if (!stillValid) {
      setSelectedSubject(student.subjects[0]?.name ?? "");
    }
  }, [student]);

  useEffect(() => {
    if (!loadingStudent) {
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [loadingStudent]);

  // Loading state
  if (loadingStudent) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ marginTop: 12, fontSize: 14, color: "#6B7280" }}>Loading student data...</Text>
      </View>
    );
  }

  // Error or not found — use empty shell
  if (!student) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Ionicons name="warning-outline" size={48} color="#EF4444" />
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", marginTop: 12 }}>Could not load student</Text>
        <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4, textAlign: "center" }}>{fetchError}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 14, backgroundColor: ACCENT, borderRadius: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* Derived data based on filter — always "filtered" now that there's no
     "All" option; activeSubject is only briefly undefined before the
     auto-select effect (or the student genuinely has no subjects yet). */
  const activeSubject = student.subjects.find((s) => s.name === selectedSubject);
  const isFiltered = !!activeSubject;

  const lessonsLabel = isFiltered
    ? `${activeSubject!.completedLessons}/${activeSubject!.totalLessons}`
    : `${student.completedLessons}/${student.totalLessons}`;

  const filterOptions = student.subjects.map((s) => s.name);
  const visibleTopics = isFiltered
    ? allTopics.filter((t) => t.subject === selectedSubject)
    : allTopics;
  const levelBadgeColors: Record<string, { bg: string; color: string }> = {
    Advanced: { bg: "#F3E8FF", color: "#9333EA" },
    Intermediate: { bg: "#FEF3C7", color: "#D97706" },
    Beginner: { bg: "#D1FAE5", color: "#059669" },
  };

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Animated.View style={[styles.profileSection, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarInitial}>{student.name.charAt(0)}</Text>
            </View>
          </View>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentMeta}>
            {student.grade}
            {student.stream ? `  •  ${student.stream}` : ""}
          </Text>
          <View style={styles.rankBadge}>
            <Ionicons name="trophy" size={14} color="#FBBF24" />
            <Text style={styles.rankText}>Rank #{student.ranking}</Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { fetchStudentDetail(true); fetchImprovement(); }}
            colors={[ACCENT]}
            tintColor={ACCENT}
          />
        }
      >

        {/* ─── Subject Filter Chips ─── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔍 Filter by Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {filterOptions.map((name) => {
              const isActive = selectedSubject === name;
              const subj = student.subjects.find((s) => s.name === name);
              const chipColor = subj?.color ?? ACCENT;
              return (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.chip,
                    isActive && { backgroundColor: chipColor, borderColor: chipColor },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedSubject(name)}
                >
                  <Text style={[styles.chipText, isActive && { color: "#fff", fontWeight: "700" }]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Filtered Header Label ─── */}
        {isFiltered && (
          <View style={[styles.filteredBanner, { backgroundColor: `${activeSubject!.color}12` }]}>
            <View style={[styles.filteredDot, { backgroundColor: activeSubject!.color }]} />
            <Text style={[styles.filteredText, { color: activeSubject!.color }]}>
              Showing {activeSubject!.name} stats
            </Text>
          </View>
        )}

        {/* ─── Stat Cards ─── */}
        <View style={styles.statGrid}>
          <StatCard icon="book" value={lessonsLabel} label="Lessons" color={ACCENT} delay={0} />
          {isFiltered && (
            <StatCard icon="document-text" value={`${activeSubject!.quizzesTaken}`} label="Quizzes" color="#8B5CF6" delay={100} />
          )}
        </View>

        {/* ─── Per-subject detail card (only when filtered) ─── */}
        {isFiltered && (
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: activeSubject!.color }]}>
            <Text style={[styles.sectionTitle, { color: activeSubject!.color }]}>
              📋 {activeSubject!.name} Details
            </Text>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Ionicons name="book-outline" size={18} color={activeSubject!.color} />
                <Text style={styles.detailLabel}>Total Lessons</Text>
                <Text style={styles.detailValue}>{activeSubject!.totalLessons}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#14B8A6" />
                <Text style={styles.detailLabel}>Completed</Text>
                <Text style={styles.detailValue}>{activeSubject!.completedLessons}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Ionicons name="help-circle-outline" size={18} color="#F59E0B" />
                <Text style={styles.detailLabel}>Quizzes Taken</Text>
                <Text style={styles.detailValue}>{activeSubject!.quizzesTaken}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                <Text style={styles.detailLabel}>Last Activity</Text>
                <Text style={styles.detailValue}>{activeSubject!.lastActivity || "—"}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── Improvement Trend (pre-quiz → post-quiz) ─── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📈 Improvement Trend</Text>
          <Text style={styles.improvementSubtitle}>
            Pre-quiz → post-quiz score change {isFiltered ? `in ${activeSubject!.name}` : "across all subjects"}
          </Text>
          {!improvement || improvement.count === 0 ? (
            <Text style={styles.emptyHint}>
              No completed pre + post quiz pairs yet for this {isFiltered ? "subject" : "student"}.
            </Text>
          ) : (
            <>
              <View style={styles.improvementStatRow}>
                <View style={styles.improvementStatBox}>
                  <Text style={[
                    styles.improvementStatValue,
                    { color: improvement.average_improvement > 0 ? "#059669" : improvement.average_improvement < 0 ? "#DC2626" : "#6B7280" },
                  ]}>
                    {improvement.average_improvement > 0 ? "+" : ""}{improvement.average_improvement}
                  </Text>
                  <Text style={styles.improvementStatLabel}>Avg. Improvement</Text>
                </View>
                <View style={styles.improvementStatBox}>
                  <Text style={styles.improvementStatValue}>{improvement.count}</Text>
                  <Text style={styles.improvementStatLabel}>Topics Compared</Text>
                </View>
              </View>
              {improvement.topics.map((t: any, i: number) => {
                const delta = t.improvement;
                const dColor = delta > 0 ? "#059669" : delta < 0 ? "#DC2626" : "#6B7280";
                return (
                  <View key={i} style={styles.improvementTopicRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.improvementTopicName} numberOfLines={1}>{t.topic}</Text>
                      <Text style={styles.improvementTopicMeta} numberOfLines={1}>
                        {t.subject} · {t.lesson} · {t.initial_quiz_marks} → {t.final_quiz_marks}
                      </Text>
                    </View>
                    <View style={[styles.deltaBadge, { backgroundColor: `${dColor}18` }]}>
                      <Text style={[styles.deltaBadgeText, { color: dColor }]}>
                        {delta > 0 ? "+" : ""}{delta}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* ─── Topic Details (expandable) ─── */}
        <View style={[styles.card, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>📋 Topic Details · {visibleTopics.length} topics</Text>
          {visibleTopics.length === 0 ? (
            <Text style={styles.emptyHint}>No topics found for this {isFiltered ? "subject" : "student"} yet.</Text>
          ) : (
            visibleTopics.map((t, i) => {
              const key = topicKey(t);
              const isExpanded = expandedTopic === key;
              const lc = levelBadgeColors[t.level] || levelBadgeColors.Beginner;
              const isLoadingExtras = loadingExtrasKey === key;
              return (
                <View key={key} style={[styles.topicCard, isExpanded && styles.topicCardExpanded]}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => toggleTopic(t)} style={styles.topicRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.topicTitle} numberOfLines={1}>{t.topic}</Text>
                      <Text style={styles.topicLesson} numberOfLines={1}>{t.lesson}</Text>
                    </View>
                    {t.level && (
                      <View style={[styles.levelBadge, { backgroundColor: lc.bg }]}>
                        <Text style={[styles.levelBadgeText, { color: lc.color }]}>{t.level}</Text>
                      </View>
                    )}
                    {/* lesson_delivered flips true the moment a post-quiz is
                        submitted for this topic — the clearest signal of
                        "the student actually finished this lesson." */}
                    <View style={[styles.unlockedBadge, { backgroundColor: t.lesson_delivered ? "#D1FAE5" : "#FEF3C7" }]}>
                      <Text style={[styles.unlockedBadgeText, { color: t.lesson_delivered ? "#059669" : "#D97706" }]}>
                        {t.lesson_delivered ? "✓ Lesson Completed" : "○ In Progress"}
                      </Text>
                    </View>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.topicExpanded}>
                      {/* Quiz scores */}
                      <View style={styles.quizScoreRow}>
                        <View style={[styles.quizScoreBox, { backgroundColor: "#FEF3C710" }]}>
                          <Text style={styles.quizScoreLabel}>Initial Quiz</Text>
                          <Text style={[styles.quizScoreValue, { color: "#D97706" }]}>
                            {t.initial_quiz_marks ?? "—"}<Text style={styles.quizScoreUnit}>/10</Text>
                          </Text>
                        </View>
                        <View style={[styles.quizScoreBox, { backgroundColor: `${ACCENT}10` }]}>
                          <Text style={styles.quizScoreLabel}>Final Quiz</Text>
                          <Text style={[styles.quizScoreValue, { color: ACCENT }]}>
                            {t.final_quiz_marks ?? "—"}<Text style={styles.quizScoreUnit}>/10</Text>
                          </Text>
                        </View>
                      </View>

                      {/* Delivered Lesson Content — teacher view only */}
                      {userType === "teacher" && t.delivered_content && (
                        <View style={styles.extrasSection}>
                          <Text style={styles.extrasSectionTitle}>Delivered Lesson Content</Text>
                          <ScrollView style={styles.deliveredContentBox} nestedScrollEnabled>
                            <Text style={styles.deliveredContentText}>{t.delivered_content}</Text>
                          </ScrollView>
                        </View>
                      )}

                      {isLoadingExtras && (
                        <ActivityIndicator size="small" color={ACCENT} style={{ marginVertical: 12 }} />
                      )}

                      {/* Engagement Sessions */}
                      {(engagementData[key] ?? []).length > 0 && (
                        <View style={styles.extrasSection}>
                          <Text style={styles.extrasSectionTitle}>Engagement Sessions</Text>
                          {engagementData[key].map((session: any, si: number) => (
                            <View key={si} style={styles.sessionCard}>
                              <Text style={styles.sessionMeta}>
                                {session.started_at ? new Date(session.started_at).toLocaleString() : ""} · {Math.round((session.duration_seconds ?? 0) / 60)}m
                              </Text>
                              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                                <Text style={styles.sessionScoreChip}>Avg: {session.avg_score}%</Text>
                                <Text style={styles.sessionScoreChip}>Min: {session.min_score}%</Text>
                                <Text style={styles.sessionScoreChip}>Max: {session.max_score}%</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* YouTube Watch History */}
                      {(youtubeData[key] ?? []).length > 0 && (
                        <View style={styles.extrasSection}>
                          <Text style={styles.extrasSectionTitle}>YouTube Watch History</Text>
                          {youtubeData[key].map((session: any, yi: number) => (
                            <View key={yi} style={styles.youtubeCard}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.youtubeTitle} numberOfLines={1}>📺 {session.video_title}</Text>
                                <Text style={styles.sessionMeta}>
                                  {session.started_at ? new Date(session.started_at).toLocaleString() : ""}
                                </Text>
                              </View>
                              <Text style={styles.sessionScoreChip}>
                                {Math.floor((session.watched_seconds ?? 0) / 60)}:{String((session.watched_seconds ?? 0) % 60).padStart(2, "0")}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Student Q&A */}
                      {(qaData[key] ?? []).length > 0 && (
                        <View style={styles.extrasSection}>
                          <Text style={styles.extrasSectionTitle}>Student Q&A</Text>
                          {qaData[key].map((qa: any, qi: number) => (
                            <View key={qi} style={styles.qaCard}>
                              <Text style={styles.sessionMeta}>
                                {qa.asked_at ? new Date(qa.asked_at).toLocaleString() : ""}
                              </Text>
                              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                                <Text style={styles.qaLabelQ}>Q</Text>
                                <Text style={styles.qaText}>{qa.question}</Text>
                              </View>
                              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                                <Text style={styles.qaLabelA}>A</Text>
                                <Text style={styles.qaAnswerText}>{qa.answer}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* ─── Recent Activity ─── */}
        <View style={[styles.card, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>🕐 Recent Activity</Text>
          {student.recentActivity.map((act, i) => (
            <View
              key={i}
              style={[
                styles.activityRow,
                i === student.recentActivity.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.activityIconWrap}>
                <Ionicons name={act.icon as any} size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityLabel}>{act.label}</Text>
                <Text style={styles.activityDate}>{act.date}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════ STYLES ═══════════════════ */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F2F5" },

  /* Header */
  header: {
    backgroundColor: ACCENT,
    paddingTop: 54,
    paddingBottom: 32,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)", top: -30, right: -30,
  },
  decorCircle2: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)", bottom: -20, left: -20,
  },
  backBtn: {
    position: "absolute", top: 54, left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
  },
  profileSection: { alignItems: "center", marginTop: 8 },
  avatarRing: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)", justifyContent: "center",
    alignItems: "center", marginBottom: 10,
  },
  avatarLarge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: ACCENT, justifyContent: "center", alignItems: "center",
  },
  avatarInitial: { fontSize: 28, fontWeight: "800", color: "#fff" },
  studentName: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  studentMeta: { fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 3 },
  rankBadge: {
    flexDirection: "row", alignItems: "center", marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 14,
    paddingVertical: 5, borderRadius: 20, gap: 5,
  },
  rankText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  /* Scroll */
  scrollArea: { flex: 1, marginTop: -12 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  /* Cards */
  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 14 },

  /* Filter chips */
  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#D1D5DB", backgroundColor: "#fff",
  },
  chipText: { fontSize: 13, fontWeight: "500", color: "#6B7280" },

  /* Filtered banner */
  filteredBanner: {
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  filteredDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  filteredText: { fontSize: 13, fontWeight: "600" },

  /* Rings */
  ringRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 },

  /* Stat grid */
  statGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", marginBottom: 14,
  },
  statCard: {
    width: (width - 44) / 2, backgroundColor: "#fff", borderRadius: 18,
    padding: 16, marginBottom: 12, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1F2937" },
  statLabel: { fontSize: 12, color: "#9CA3AF", marginTop: 2, fontWeight: "500" },

  /* Subject bars */
  subjectRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  subjectName: { width: 100, fontSize: 13, color: "#4B5563", fontWeight: "600" },
  barTrack: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: "#F3F4F6", marginRight: 10, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 5 },
  subjectScore: { fontSize: 13, fontWeight: "800", width: 42, textAlign: "right" },

  /* Detail rows (per-subject) */
  detailRow: { flexDirection: "row", marginBottom: 16 },
  detailItem: {
    flex: 1, alignItems: "center", gap: 4,
  },
  detailLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "500", textAlign: "center" },
  detailValue: { fontSize: 18, fontWeight: "800", color: "#1F2937" },

  /* Activity */
  activityRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderColor: "#F3F4F6",
  },
  activityIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "#E0F2F1", justifyContent: "center",
    alignItems: "center", marginRight: 12,
  },
  activityLabel: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  activityDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  /* Lessons list */
  lessonRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderTopWidth: 1, borderColor: "#F3F4F6",
  },
  lessonDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  lessonTitle: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  lessonSubject: { fontSize: 11, fontWeight: "600" },
  lessonDuration: { fontSize: 11, color: "#9CA3AF" },
  lessonStatusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8,
  },

  /* Lesson progress bar */
  lessonProgressStatRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  lessonProgressStatBox: {
    flex: 1, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#F3F4F6",
  },
  lessonProgressStatValue: { fontSize: 24, fontWeight: "800" },
  lessonProgressStatLabel: { fontSize: 11, color: "#9CA3AF", marginTop: 4, fontWeight: "500" },
  lessonBarTrack: {
    height: 8, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden",
  },
  lessonBarFill: { height: "100%", borderRadius: 4 },

  /* Improvement trend */
  improvementSubtitle: { fontSize: 12, color: "#6B7280", marginTop: -8, marginBottom: 14 },
  emptyHint: { fontSize: 13, color: "#9CA3AF" },
  improvementStatRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  improvementStatBox: {
    flex: 1, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#F3F4F6",
  },
  improvementStatValue: { fontSize: 24, fontWeight: "800", color: "#1F2937" },
  improvementStatLabel: { fontSize: 11, color: "#9CA3AF", marginTop: 4, fontWeight: "500" },
  improvementTopicRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#F3F4F6",
  },
  improvementTopicName: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
  improvementTopicMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  deltaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 10 },
  deltaBadgeText: { fontSize: 12, fontWeight: "800" },

  /* Topic details (expandable) */
  topicCard: {
    borderRadius: 12, borderWidth: 1, borderColor: "#F3F4F6", marginBottom: 8, overflow: "hidden",
  },
  topicCardExpanded: { borderColor: ACCENT },
  topicRow: {
    flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#F9FAFB", gap: 8,
  },
  topicTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  topicLesson: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  levelBadgeText: { fontSize: 10, fontWeight: "700" },
  unlockedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  unlockedBadgeText: { fontSize: 10, fontWeight: "700" },
  topicExpanded: { padding: 14, borderTopWidth: 1, borderTopColor: "#F3F4F6" },

  quizScoreRow: { flexDirection: "row", gap: 10 },
  quizScoreBox: { flex: 1, borderRadius: 10, padding: 12 },
  quizScoreLabel: { fontSize: 10, color: "#9CA3AF", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  quizScoreValue: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  quizScoreUnit: { fontSize: 12, color: "#9CA3AF", fontWeight: "400" },

  extrasSection: { marginTop: 16 },
  extrasSectionTitle: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  deliveredContentBox: {
    maxHeight: 180, backgroundColor: "#F9FAFB", borderRadius: 10,
    borderWidth: 1, borderColor: "#F3F4F6", padding: 14,
  },
  deliveredContentText: { fontSize: 13, color: "#4B5563", lineHeight: 20 },
  sessionMeta: { fontSize: 11, color: "#9CA3AF" },
  sessionScoreChip: {
    fontSize: 11, fontWeight: "700", color: "#1F2937",
    backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  sessionCard: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 8 },
  youtubeCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 8, gap: 8,
  },
  youtubeTitle: { fontSize: 12, fontWeight: "700", color: ACCENT },
  qaCard: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 8 },
  qaLabelQ: { fontSize: 11, fontWeight: "800", color: ACCENT },
  qaLabelA: { fontSize: 11, fontWeight: "800", color: "#059669" },
  qaText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#1F2937" },
  qaAnswerText: { flex: 1, fontSize: 13, color: "#6B7280", lineHeight: 19 },
});
