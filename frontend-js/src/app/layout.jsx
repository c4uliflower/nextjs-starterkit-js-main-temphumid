import { AppProviders } from "@/components/layout/AppProviders";
import { Nunito, Nunito_Sans } from "next/font/google";
import "./globals.css";
const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});
const nunitoMono = Nunito({
  variable: "--font-nunito-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Temperature & Humidity Monitoring System",
  description: "Migrated Next.js dashboard and component showcase",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${nunitoSans.variable} ${nunitoMono.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
