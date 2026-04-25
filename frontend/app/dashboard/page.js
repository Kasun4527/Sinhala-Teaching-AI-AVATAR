"use client";

import { useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  
   
  useEffect(()=>{
    const token=localStorage.getItem("token");
    if(!token){
        router.push("/login");
    }
  },[]);

  const handleLogout = () => {
  localStorage.removeItem("token"); // remove JWT
  localStorage.removeItem("user");  // if you stored user data

  window.location.href = "/login";  // redirect to login
};

  return (
    <div className="flex flex-col items-center mt-20">
      <h1 className="text-3xl font-bold mb-6">
        Select Subject
      </h1>
      <button
  onClick={handleLogout}
  className="bg-red-500 text-white px-4 py-2 rounded"
>
  Logout
</button>

      <div className="grid grid-cols-2 gap-6">
        {curriculum.map((item, i) => (
          <button
            key={i}
            onClick={() => router.push(`/sub-lesson?subject=${item.subject}`)}
            className="p-6 bg-white border rounded shadow hover:bg-blue-100"
          >
            {item.subject}
          </button>
        ))}
      </div>
    </div>
  );
}