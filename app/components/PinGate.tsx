"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const CORRECT_PIN = "8245"; // ← Change this to your real pin

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("dashboard_pin");
    if (stored === CORRECT_PIN) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      localStorage.setItem("dashboard_pin", pin);
      setIsAuthenticated(true);
    } else {
      alert("Wrong PIN");
    }
  };

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
      <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-xs">
        <h1 className="text-2xl font-bold text-center">Enter PIN</h1>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full p-2 text-black rounded"
          placeholder="Enter PIN"
        />
        <button
          type="submit"
          className="w-full bg-white text-black py-2 px-4 rounded hover:bg-gray-300"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
