"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signupUser } from "@/services/api";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    try {
      await signupUser({
        name,
        email,
        password,
        role: "student",
      });

      router.push("/login");
    } catch (err) {
      console.error("❌ Signup error:", err);
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Signup</h1>

      <input
        placeholder="Name"
        onChange={(e) => setName(e.target.value)}
        className="block mt-2 border p-2"
      />

      <input
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
        onClick={handleSignup}
        className="mt-4 bg-blue-500 text-white px-4 py-2"
      >
        Signup as Student
      </button>
       <p className="mt-4 text-sm">
  Already have account?{" "}
  <span
    onClick={() => router.push("/login")}
    className="text-blue-500 cursor-pointer underline"
  >
    Login
  </span>
</p>
    </div>
  );
}