import "./globals.css";

export const metadata = {
  title: "AI Guru — Sinhala AI Avatar Teacher",
  description: "Sri Lanka's first AI Avatar teaching platform — personalized Sinhala-medium lessons in Physics, Chemistry, Biology, Maths, Economics and Buddhism.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
