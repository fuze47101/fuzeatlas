"use client";
import Image from "next/image";

interface FuzeLogoProps {
  size?: "sm" | "md" | "lg";
  layout?: "horizontal" | "stacked" | "icon";
  theme?: "light" | "dark";  // light = for dark backgrounds, dark = for light backgrounds
}

export default function FuzeLogo({ size = "md", layout = "horizontal", theme = "dark" }: FuzeLogoProps) {
  const dims: Record<string, Record<string, { width: number; height: number }>> = {
    horizontal: {
      sm: { width: 120, height: 37 },
      md: { width: 160, height: 49 },
      lg: { width: 200, height: 61 },
    },
    stacked: {
      sm: { width: 100, height: 75 },
      md: { width: 140, height: 104 },
      lg: { width: 200, height: 149 },
    },
    icon: {
      sm: { width: 28, height: 21 },
      md: { width: 40, height: 31 },
      lg: { width: 64, height: 49 },
    },
  };

  const srcMap: Record<string, Record<string, string>> = {
    horizontal: { dark: "/fuze-logo-horizontal.png", light: "/fuze-logo-horizontal-light.png" },
    stacked: { dark: "/fuze-logo-stacked.png", light: "/fuze-logo-stacked-light.png" },
    icon: { dark: "/fuze-icon.png", light: "/fuze-icon.png" },
  };

  const d = dims[layout][size];
  const src = srcMap[layout][theme];

  return (
    <Image
      src={src}
      alt="FUZE Technologies"
      width={d.width}
      height={d.height}
      priority
      className="object-contain"
    />
  );
}
