import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import LottieView from "lottie-react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../constants/api";
import { saveSession } from "../constants/auth";
import { takePendingLinks } from "../constants/pendingTeacherLinks";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
    })();
  }, []);

  const handleBiometricAuth = async () => {
    try {
      const savedBiometrics = await LocalAuthentication.isEnrolledAsync();
      if (!savedBiometrics) {
        Alert.alert(
          "Biometrics not found",
          "Please set up fingerprint or face ID on your device."
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login with Fingerprint/Face ID",
        fallbackLabel: "Enter Password",
        disableDeviceFallback: false,
      });

      if (result.success) {
        router.replace("/parent-dashboard");
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Authentication failed");
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      // ✅ Persist session to AsyncStorage
      // Note: /auth/login's response has no "email" field — use the address
      // the user just typed in, since we already have it right here.
      await saveSession({
        token: data.token,
        role: data.role,
        name: data.name,
        email: email,
        student_id: data.student_id,
        associated_students: data.associated_students ?? [],
      });

      // ✅ Route based on role
      // Note: the backend has no "teacher" role — teacher accounts are
      // stored as role "admin" (same as the web admin signup/dashboard).
      if (data.role === "admin") {
        // Link any students entered at signup, now that we finally know
        // this teacher's own account id (data.student_id, despite the name).
        const pendingIds = await takePendingLinks(email);
        if (pendingIds.length > 0) {
          const failures: string[] = [];
          for (const studentId of pendingIds) {
            try {
              const linkResp = await fetch(`${API_BASE_URL}/auth/set-teacher-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  student_id: studentId.trim(),
                  teacher_code: data.student_id,
                }),
              });
              if (!linkResp.ok) failures.push(studentId);
            } catch {
              failures.push(studentId);
            }
          }
          if (failures.length > 0) {
            Alert.alert(
              "Some students couldn't be linked",
              `These IDs weren't found: ${failures.join(", ")}. You can add them later from your dashboard.`
            );
          }
        }
        router.replace("/teacher-dashboard");
      } else if (data.role === "parent") {
        router.replace("/parent-dashboard");
      } else {
        Alert.alert("Access Denied", "This app is for parents and teachers only.");
      }
    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.container}>

          {/* Animated Avatar */}
          <LottieView
            source={require("../assets/animations/login.json")}
            autoPlay
            loop
            style={{ width: 200, height: 200, alignSelf: "center" }}
          />

          <Text style={styles.title}>Welcome Back 👋</Text>

          <TextInput
            placeholder="Email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Password"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          {isBiometricSupported && (
            <TouchableOpacity
              style={[styles.button, styles.biometricButton]}
              onPress={handleBiometricAuth}
            >
              <Ionicons name="finger-print" size={24} color="#009688" />
              <Text style={styles.biometricText}>Login with Fingerprint</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.link}>
              Don't have an account? Sign Up
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f2f6ff",
    justifyContent: "center",
    padding: 25,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
  },
  button: {
    backgroundColor: "#009688",
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  biometricButton: {
    backgroundColor: "#e0f2f1",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 15,
  },
  biometricText: {
    color: "#009688",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: "#159b5c",
  },
});
