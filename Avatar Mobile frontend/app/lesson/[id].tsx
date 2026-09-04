import React, { useState, useRef, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Animated,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const ACCENT = "#009688";

/* ── Mock lesson data ── */
interface LessonData {
    id: string;
    title: string;
    subject: string;
    subjectColor: string;
    duration: string;
    deliveredDate: string;
    status: "completed" | "in-progress" | "not-started";
    description: string;
    objectives: string[];
    content: string[];
    resources: { name: string; type: string }[];
    quizScore?: number;
    watchTime?: string;
    feedbacks: { author: string; date: string; text: string; rating: number }[];
}

const lessonsMap: Record<string, LessonData> = {
    "L1": {
        id: "L1",
        title: "Introduction to Algebra",
        subject: "Mathematics",
        subjectColor: "#6366F1",
        duration: "45 min",
        deliveredDate: "Feb 10, 2026",
        status: "completed",
        description: "This lesson introduces the fundamental concepts of algebra, including variables, expressions, and basic equations. Students learn to translate word problems into algebraic expressions.",
        objectives: [
            "Understand what variables represent",
            "Write and evaluate algebraic expressions",
            "Solve simple one-step equations",
        ],
        content: [
            "📖  What is Algebra? — Algebra is the branch of mathematics that uses symbols (variables) to represent unknown values.",
            "📝  Variables & Expressions — A variable is a letter that stands for a number. Example: in 3x + 5, 'x' is the variable.",
            "🧮  Solving Equations — To solve x + 7 = 12, subtract 7 from both sides: x = 5.",
            "💡  Real-world Application — If a shop sells pens for Rs. 15 each, the cost for 'n' pens is 15n.",
        ],

        quizScore: 85,
        watchTime: "38 min",
        feedbacks: [],
    },
    "L2": {
        id: "L2",
        title: "Newton's Laws of Motion",
        subject: "Science",
        subjectColor: "#14B8A6",
        duration: "50 min",
        deliveredDate: "Feb 12, 2026",
        status: "completed",
        description: "Covers Newton's three laws of motion with real-world examples and simple experiments that demonstrate each law in action.",
        objectives: [
            "State Newton's three laws of motion",
            "Apply the laws to everyday situations",
            "Calculate force using F = ma",
        ],
        content: [
            "📖  First Law (Inertia) — An object stays at rest or in motion unless acted upon by an external force.",
            "📝  Second Law (F = ma) — Force equals mass times acceleration. A heavier object needs more force to accelerate.",
            "🔬  Third Law (Action-Reaction) — For every action, there is an equal and opposite reaction.",
            "💡  Experiment — Push a toy car on different surfaces to observe friction's effect on motion.",
        ],

        quizScore: 72,
        watchTime: "45 min",
        feedbacks: [],
    },
    "L3": {
        id: "L3",
        title: "Essay Writing Techniques",
        subject: "English",
        subjectColor: "#F59E0B",
        duration: "40 min",
        deliveredDate: "Feb 14, 2026",
        status: "completed",
        description: "Teaches students how to structure an essay with a clear introduction, body paragraphs, and conclusion. Includes persuasive writing elements.",
        objectives: [
            "Write a clear thesis statement",
            "Organize body paragraphs with topic sentences",
            "Use transition words effectively",
        ],
        content: [
            "📖  Essay Structure — Every essay has three parts: Introduction, Body, and Conclusion.",
            "📝  Thesis Statement — One sentence that tells the reader what the essay is about. Place it at the end of the introduction.",
            "✍️  Body Paragraphs — Each paragraph should start with a topic sentence, followed by evidence and explanations.",
            "🔗  Transitions — Words like 'however', 'furthermore', and 'in conclusion' help connect ideas.",
        ],

        quizScore: 80,
        watchTime: "35 min",
        feedbacks: [],
    },
    "L4": {
        id: "L4",
        title: "Ancient Civilizations",
        subject: "History",
        subjectColor: "#EF4444",
        duration: "35 min",
        deliveredDate: "Feb 8, 2026",
        status: "completed",
        description: "Explores the major ancient civilizations including Mesopotamia, Egypt, and the Indus Valley. Covers their contributions to modern society.",
        objectives: [
            "Identify major ancient civilizations on a map",
            "Describe key achievements of each civilization",
            "Compare and contrast ancient societies",
        ],
        content: [
            "🏛️  Mesopotamia — Known as the 'Cradle of Civilization', developed writing (cuneiform) and the wheel.",
            "🏺  Ancient Egypt — Famous for pyramids, hieroglyphics, and advances in medicine and architecture.",
            "🏘️  Indus Valley — Planned cities with drainage systems, standardized weights, and trade networks.",
            "📜  Legacy — These civilizations gave us writing, mathematics, law codes, and agricultural techniques.",
        ],

        quizScore: 91,
        watchTime: "32 min",
        feedbacks: [],
    },
    "L5": {
        id: "L5",
        title: "Quadratic Equations",
        subject: "Mathematics",
        subjectColor: "#6366F1",
        duration: "50 min",
        deliveredDate: "Feb 15, 2026",
        status: "in-progress",
        description: "Introduces quadratic equations and methods to solve them including factoring, completing the square, and the quadratic formula.",
        objectives: [
            "Identify quadratic equations",
            "Solve by factoring",
            "Apply the quadratic formula",
        ],
        content: [
            "📖  What is a Quadratic? — An equation of the form ax² + bx + c = 0 where a ≠ 0.",
            "📝  Factoring — Break down the equation into two brackets: (x + p)(x + q) = 0.",
            "🧮  Quadratic Formula — x = (-b ± √(b²-4ac)) / 2a. Works for all quadratic equations.",
            "📊  Graphing — Quadratic equations form a parabola when graphed.",
        ],

        watchTime: "22 min",
        feedbacks: [],
    },
};

/* ── Star rating component ── */
function StarRating({
    rating,
    onRate,
    size = 24,
}: {
    rating: number;
    onRate?: (r: number) => void;
    size?: number;
}) {
    return (
        <View style={{ flexDirection: "row", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                    key={star}
                    onPress={() => onRate?.(star)}
                    disabled={!onRate}
                    activeOpacity={onRate ? 0.6 : 1}
                >
                    <Ionicons
                        name={star <= rating ? "star" : "star-outline"}
                        size={size}
                        color={star <= rating ? "#FBBF24" : "#D1D5DB"}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
}

/* ════════════════════════════════════════════ */
/*             LESSON DETAIL PAGE              */
/* ════════════════════════════════════════════ */
export default function LessonDetail() {
    const { id, userType } = useLocalSearchParams<{ id: string; userType: string }>();
    const router = useRouter();
    const lesson = lessonsMap[id ?? "L1"] ?? lessonsMap["L1"];

    const [feedbackText, setFeedbackText] = useState("");
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [localFeedbacks, setLocalFeedbacks] = useState(lesson.feedbacks);
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);

    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    const statusConfig = {
        completed: { label: "Completed", color: "#14B8A6", icon: "checkmark-circle" },
        "in-progress": { label: "In Progress", color: "#F59E0B", icon: "time" },
        "not-started": { label: "Not Started", color: "#9CA3AF", icon: "ellipse-outline" },
    };
    const statusInfo = statusConfig[lesson.status];

    const handleSubmitFeedback = () => {
        if (!feedbackText.trim()) {
            Alert.alert("Error", "Please enter your feedback");
            return;
        }
        if (feedbackRating === 0) {
            Alert.alert("Error", "Please select a rating");
            return;
        }

        const newFeedback = {
            author: "You",
            date: "Just now",
            text: feedbackText.trim(),
            rating: feedbackRating,
        };

        setLocalFeedbacks([newFeedback, ...localFeedbacks]);
        setFeedbackText("");
        setFeedbackRating(0);
        setShowFeedbackForm(false);
        Alert.alert("Success ✅", "Your feedback has been submitted!");
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {/* ── Header ── */}
            <View style={[styles.header, { backgroundColor: lesson.subjectColor }]}>
                <View style={styles.decorCircle1} />
                <View style={styles.decorCircle2} />

                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>

                <Animated.View style={[styles.headerContent, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
                    <View style={styles.subjectBadge}>
                        <Text style={styles.subjectBadgeText}>{lesson.subject}</Text>
                    </View>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <View style={styles.headerMeta}>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.metaText}>{lesson.duration}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.metaText}>{lesson.deliveredDate}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}30` }]}>
                        <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.color} />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                    </View>
                </Animated.View>
            </View>

            {/* ── Scrollable Content ── */}
            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Stats row */}
                {(lesson.quizScore || lesson.watchTime) && (
                    <View style={styles.statsRow}>
                        {lesson.quizScore && (
                            <View style={styles.miniStat}>
                                <Ionicons name="ribbon" size={18} color="#F59E0B" />
                                <Text style={styles.miniStatValue}>{lesson.quizScore}%</Text>
                                <Text style={styles.miniStatLabel}>Quiz Score</Text>
                            </View>
                        )}
                        {lesson.watchTime && (
                            <View style={styles.miniStat}>
                                <Ionicons name="eye" size={18} color="#14B8A6" />
                                <Text style={styles.miniStatValue}>{lesson.watchTime}</Text>
                                <Text style={styles.miniStatLabel}>Watch Time</Text>
                            </View>
                        )}

                    </View>
                )}

                {/* Description */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>📄 Description</Text>
                    <Text style={styles.descriptionText}>{lesson.description}</Text>
                </View>

                {/* Objectives */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>🎯 Learning Objectives</Text>
                    {lesson.objectives.map((obj, i) => (
                        <View key={i} style={styles.objectiveRow}>
                            <View style={[styles.objectiveDot, { backgroundColor: lesson.subjectColor }]} />
                            <Text style={styles.objectiveText}>{obj}</Text>
                        </View>
                    ))}
                </View>

                {/* Lesson Content */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>📚 Lesson Content</Text>
                    {lesson.content.map((block, i) => (
                        <View key={i} style={styles.contentBlock}>
                            <Text style={styles.contentText}>{block}</Text>
                        </View>
                    ))}
                </View>



                {/* Teacher Feedback Section */}
                <View style={[styles.card, { marginBottom: 6 }]}>
                    <View style={styles.feedbackHeader}>
                        <Text style={styles.sectionTitle}>💬 Teacher Feedback</Text>
                        {userType !== "parent" && (
                            <TouchableOpacity
                                style={[styles.addFeedbackBtn, { backgroundColor: ACCENT }]}
                                onPress={() => setShowFeedbackForm(!showFeedbackForm)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name={showFeedbackForm ? "close" : "add"} size={18} color="#fff" />
                                <Text style={styles.addFeedbackText}>
                                    {showFeedbackForm ? "Cancel" : "Add"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Feedback Form */}
                    {showFeedbackForm && (
                        <View style={styles.feedbackForm}>
                            <Text style={styles.formLabel}>Your Rating</Text>
                            <StarRating rating={feedbackRating} onRate={setFeedbackRating} size={28} />

                            <Text style={[styles.formLabel, { marginTop: 14 }]}>Your Feedback</Text>
                            <TextInput
                                style={styles.feedbackInput}
                                placeholder="Write your feedback about this lesson content..."
                                placeholderTextColor="#9CA3AF"
                                value={feedbackText}
                                onChangeText={setFeedbackText}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: ACCENT }]}
                                onPress={handleSubmitFeedback}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="send" size={16} color="#fff" />
                                <Text style={styles.submitBtnText}>Submit Feedback</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Existing feedbacks */}
                    {localFeedbacks.length === 0 && !showFeedbackForm && (
                        <View style={styles.emptyFeedback}>
                            <Ionicons name="chatbubble-outline" size={32} color="#D1D5DB" />
                            <Text style={styles.emptyFeedbackText}>No feedback yet</Text>
                            <Text style={styles.emptyFeedbackSub}>Be the first to share your thoughts</Text>
                        </View>
                    )}

                    {localFeedbacks.map((fb, i) => (
                        <View key={i} style={[styles.feedbackCard, i === 0 && showFeedbackForm && { marginTop: 12 }]}>
                            <View style={styles.feedbackCardHeader}>
                                <View style={styles.feedbackAuthorWrap}>
                                    <View style={styles.feedbackAvatar}>
                                        <Text style={styles.feedbackAvatarText}>{fb.author.charAt(0)}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.feedbackAuthor}>{fb.author}</Text>
                                        <Text style={styles.feedbackDate}>{fb.date}</Text>
                                    </View>
                                </View>
                                <StarRating rating={fb.rating} size={14} />
                            </View>
                            <Text style={styles.feedbackText}>{fb.text}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

/* ═══════════════════ STYLES ═══════════════════ */
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F0F2F5" },

    /* Header */
    header: {
        paddingTop: 54, paddingBottom: 28, paddingHorizontal: 20,
        borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden",
    },
    decorCircle1: {
        position: "absolute", width: 140, height: 140, borderRadius: 70,
        backgroundColor: "rgba(255,255,255,0.08)", top: -30, right: -30,
    },
    decorCircle2: {
        position: "absolute", width: 90, height: 90, borderRadius: 45,
        backgroundColor: "rgba(255,255,255,0.06)", bottom: -15, left: -15,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.18)",
        justifyContent: "center", alignItems: "center", marginBottom: 14,
    },
    headerContent: { paddingLeft: 4 },
    subjectBadge: {
        alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.2)",
        paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8,
    },
    subjectBadgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },
    lessonTitle: { fontSize: 22, fontWeight: "800", color: "#fff", lineHeight: 28 },
    headerMeta: { flexDirection: "row", gap: 16, marginTop: 10 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
    statusBadge: {
        flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
        gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 10,
    },
    statusText: { fontSize: 12, fontWeight: "700" },

    /* Scroll */
    scrollArea: { flex: 1, marginTop: -10 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 18 },

    /* Stats row */
    statsRow: {
        flexDirection: "row", justifyContent: "space-around", marginBottom: 14,
        backgroundColor: "#fff", borderRadius: 16, padding: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    miniStat: { alignItems: "center", gap: 4 },
    miniStatValue: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
    miniStatLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },

    /* Cards */
    card: {
        backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 14,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 12 },

    /* Description */
    descriptionText: { fontSize: 14, lineHeight: 22, color: "#4B5563" },

    /* Objectives */
    objectiveRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
    objectiveDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    objectiveText: { flex: 1, fontSize: 14, lineHeight: 20, color: "#4B5563" },

    /* Content */
    contentBlock: {
        backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 10,
        borderLeftWidth: 3, borderLeftColor: ACCENT,
    },
    contentText: { fontSize: 14, lineHeight: 22, color: "#374151" },



    /* Feedback */
    feedbackHeader: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4,
    },
    addFeedbackBtn: {
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    },
    addFeedbackText: { fontSize: 13, fontWeight: "600", color: "#fff" },

    feedbackForm: {
        backgroundColor: "#F9FAFB", borderRadius: 14, padding: 16, marginTop: 10, marginBottom: 6,
    },
    formLabel: { fontSize: 13, fontWeight: "600", color: "#4B5563", marginBottom: 8 },
    feedbackInput: {
        backgroundColor: "#fff", borderRadius: 12, padding: 14,
        fontSize: 14, color: "#1F2937", minHeight: 100,
        borderWidth: 1, borderColor: "#E5E7EB",
    },
    submitBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 6, paddingVertical: 12, borderRadius: 12, marginTop: 14,
    },
    submitBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

    emptyFeedback: { alignItems: "center", paddingVertical: 24 },
    emptyFeedbackText: { fontSize: 15, fontWeight: "600", color: "#9CA3AF", marginTop: 8 },
    emptyFeedbackSub: { fontSize: 12, color: "#D1D5DB", marginTop: 2 },

    feedbackCard: {
        backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, marginTop: 8,
    },
    feedbackCardHeader: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
    },
    feedbackAuthorWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
    feedbackAvatar: {
        width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENT,
        justifyContent: "center", alignItems: "center",
    },
    feedbackAvatarText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    feedbackAuthor: { fontSize: 13, fontWeight: "700", color: "#1F2937" },
    feedbackDate: { fontSize: 11, color: "#9CA3AF" },
    feedbackText: { fontSize: 13, lineHeight: 20, color: "#4B5563" },
});
