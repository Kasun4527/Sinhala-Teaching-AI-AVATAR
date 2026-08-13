import "./globals.css";
import FluidMistyCursor from "../components/FluidMistyCursor";

export const metadata = {
  title: "AI Guru — Sinhala AI Avatar Teacher",
  description: "Sri Lanka's first AI Avatar teaching platform — personalized Sinhala-medium lessons in Physics, Chemistry, Biology, Maths, Economics and Buddhism.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
          WebGL Navier-Stokes fluid cursor — fixed canvas overlay.
          pointer-events-none ensures it NEVER blocks clicks or taps.
          z-50 places it above page content but below modals (z-[100]).
        */}
        <FluidMistyCursor />
        {children}
      </body>
    </html>
  );
}
