import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FUZE Atlas",
  description: "FUZE Atlas — lab and textile intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        {children}
      </body>
    </html>
  );
}