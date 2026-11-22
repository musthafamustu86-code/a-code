import localFont from "next/font/local";
import "./globals.css";
const sans = localFont({ src: "./fonts/manrope.ttf", variable: "--sans" });
const serif = localFont({ src: "./fonts/newsreader.ttf", variable: "--serif" });
export const metadata = {
  title: "Star System · Sincere Academy",
  description: "Staff workspace for student attendance and recognition",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable + " " + serif.variable}>
      <body>{children}</body>
    </html>
  );
}
