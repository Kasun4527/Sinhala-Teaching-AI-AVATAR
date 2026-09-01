import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import LottieView from "lottie-react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../constants/api";
import { savePendingLinks } from "../constants/pendingTeacherLinks";
import { saveChildren } from "../constants/parentChildren";
import { ActivityIndicator } from "react-native";

export default function SignUp() {
  const router = useRouter();
  const [role, setRole] = useState("parent");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childrenRegNos, setChildrenRegNos] = useState<string[]>([""]);
  const [studentRegNos, setStudentRegNos] = useState<string[]>([""]);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(compatible && enrolled);
    })();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  /* Helper funcs for Children inputs (Parents) */
  const addChild = () => {
    setChildrenRegNos([...childrenRegNos, ""]);
  };

  const removeChild = (index: number) => {
    const updated = [...childrenRegNos];
    updated.splice(index, 1);
    setChildrenRegNos(updated);
  };

  const updateChildReg = (text: string, index: number) => {
    const updated = [...childrenRegNos];
    updated[index] = text;
    setChildrenRegNos(updated);
  };

  /* Helper funcs for Student inputs (Teachers) */

  const addStudent = () => {
    setStudentRegNos([...studentRegNos, ""]);
  };

  const removeStudent = (index: number) => {
    const updated = [...studentRegNos];
    updated.splice(index, 1);
    setStudentRegNos(updated);
  };

  const updateStudentReg = (text: string, index: number) => {
    const updated = [...studentRegNos];
    updated[index] = text;
    setStudentRegNos(updated);
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    const students = role === "teacher" ? studentRegNos : childrenRegNos;
    if (students.some(reg => !reg.trim())) {
      Alert.alert("Error", `Please fill all ${role === "teacher" ? "student" : "child"} IDs`);
      return;
    }

    // The backend has no "teacher" role — teacher accounts are stored as
    // role "admin" (same as the web admin signup). The UI keeps calling it
    // "Teacher" for the user; only the value sent to the backend changes.
    const backendRole = role === "teacher" ? "admin" : role;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName,
          email: email,
          password: password,
          role: backendRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      if (role === "teacher") {
        // Backend has no field to store these at signup time — the account
        // must exist and be verified first. /auth/set-teacher-code (the
        // backend's real linking endpoint) runs once this teacher logs in
        // for the first time and we finally know their own account id.
        await savePendingLinks(email, studentRegNos.filter(s => s.trim() !== ""));
        Alert.alert(
          "Success",
          "Account created! Please verify your email, then log in — your students will be linked automatically on first login."
        );
      } else {
        // Backend has no field to store a parent's children either, and no
        // linking endpoint like teachers get — kept on-device instead, read
        // back by the parent dashboard on every load.
        await saveChildren(email, childrenRegNos.filter(s => s.trim() !== ""));
        Alert.alert("Success", "Account created successfully! Please login.");
      }
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const toggleBiometrics = async () => {
    if (!isBiometricEnabled) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Verify to enable Biometric Login",
          fallbackLabel: "Use Password",
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsBiometricEnabled(true);
          Alert.alert("Success", "Biometric login is now enabled for your account.");
        } else {
          Alert.alert("Authentication Failed", "Could not verify biometrics.");
        }
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "An error occurred with biometric authentication.");
      }
    } else {
      setIsBiometricEnabled(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

            {/* Animated Avatar */}
            <LottieView
              source={require("../assets/animations/login.json")}
              autoPlay
              loop
              style={{ width: 180, height: 180, alignSelf: "center" }}
            />

            <Text style={styles.title}>
              Let’s create your account ✨
            </Text>

            {/* Role Selection */}
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "parent" && styles.activeRole,
                ]}
                onPress={() => setRole("parent")}
              >
                <Text style={styles.roleText}>Parent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === "teacher" && styles.activeRole,
                ]}
                onPress={() => setRole("teacher")}
              >
                <Text style={styles.roleText}>Teacher</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Full Name"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
            />

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

            {/* Conditional Fields */}
            {role === "teacher" ? (
              <View style={{ marginBottom: 15 }}>
                <Text style={{ marginBottom: 10, fontWeight: "600", color: "#555" }}>
                  Student IDs
                </Text>
                <Text style={{ marginBottom: 10, fontSize: 12, color: "#888" }}>
                  The student's account ID (shown on their profile) — they must already have a registered account.
                </Text>
                {studentRegNos.map((reg, index) => (
                  <View key={index} style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                    <TextInput
                      placeholder={`Student ${index + 1} ID`}
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={reg}
                      onChangeText={(text) => updateStudentReg(text, index)}
                    />
                    {studentRegNos.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeStudent(index)}
                        style={{ justifyContent: "center", paddingHorizontal: 10 }}
                      >
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ color: "white", fontWeight: "bold" }}>X</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity onPress={addStudent} style={styles.addChildBtn}>
                  <Text style={styles.addChildText}>+ Add Another Student</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginBottom: 15 }}>
                <Text style={{ marginBottom: 10, fontWeight: "600", color: "#555" }}>
                  Children Registration Numbers
                </Text>
                {childrenRegNos.map((reg, index) => (
                  <View key={index} style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                    <TextInput
                      placeholder={`Child ${index + 1} Reg No`}
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={reg}
                      onChangeText={(text) => updateChildReg(text, index)}
                    />
                    {childrenRegNos.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeChild(index)}
                        style={{ justifyContent: "center", paddingHorizontal: 10 }}
                      >
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ color: "white", fontWeight: "bold" }}>X</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity onPress={addChild} style={styles.addChildBtn}>
                  <Text style={styles.addChildText}>+ Add Another Child</Text>
                </TouchableOpacity>
              </View>
            )}

            {isBiometricSupported && (
              <TouchableOpacity
                style={[styles.biometricToggle, isBiometricEnabled && styles.biometricToggleActive]}
                onPress={toggleBiometrics}
              >
                <Ionicons name="finger-print" size={24} color={isBiometricEnabled ? "white" : "#009688"} />
                <Text style={[styles.biometricToggleText, isBiometricEnabled && { color: "white" }]}>
                  {isBiometricEnabled ? "Biometric Login Enabled" : "Enable Biometric Login"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>
                  Sign Up as {role}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/login")}
              style={{ marginTop: 20 }}
            >
              <Text style={{ textAlign: "center", color: "#159b5c" }}>
                Already have an account? Login
              </Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f6ff",
    justifyContent: "center",
    padding: 25,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  roleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    backgroundColor: "#ddd",
    borderRadius: 10,
    marginHorizontal: 5,
  },
  activeRole: {
    backgroundColor: "#009688",
  },
  roleText: {
    textAlign: "center",
    color: "#000",
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#009688",
    padding: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  addChildBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#009688",
    borderRadius: 10,
    borderStyle: "dashed",
    marginTop: 5,
  },
  addChildText: {
    color: "#009688",
    textAlign: "center",
    fontWeight: "600",
  },
  biometricToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#009688",
    marginBottom: 15,
    gap: 10,
  },
  biometricToggleActive: {
    backgroundColor: "#009688",
  },
  biometricToggleText: {
    color: "#009688",
    fontWeight: "bold",
    fontSize: 16,
  },
});
