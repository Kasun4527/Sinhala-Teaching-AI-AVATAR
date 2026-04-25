"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await loginUser({ email, password });

      // ✅ store auth data
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("name", res.data.name);
      localStorage.setItem("student_id", res.data.student_id);

      if (res.data.role === "admin") {
  router.push("/admin/dashboard");
} else {
  router.push("/dashboard"); // your existing student dashboard
}
    } catch (err) {
      console.error("❌ Login error:", err);
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Login</h1>

      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
        className="block mt-2 border p-2"
      />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
        className="block mt-2 border p-2"
      />

      <button
        onClick={handleLogin}
        className="mt-4 bg-green-500 text-white px-4 py-2"
      >
        Login
      </button>
      <p className="mt-4 text-sm">
  Don't have an account?{" "}
  <span
    onClick={() => router.push("/signup")}
    className="text-blue-500 cursor-pointer underline"
  >
    Sign up
  </span>
</p>
    </div>
  );
}