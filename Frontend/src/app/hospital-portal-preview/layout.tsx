import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hospital Portal",
  description: "Redirect to home",
};

export default function HospitalPortalPreviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
