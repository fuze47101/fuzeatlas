"use client";

interface FuzeLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  showText?: boolean;
}

export default function FuzeLogo({ size = "md", variant = "light", showText = true }: FuzeLogoProps) {
  const sizes = {
    sm: { icon: 24, text: "text-sm", gap: "gap-1.5" },
    md: { icon: 32, text: "text-xl", gap: "gap-2" },
    lg: { icon: 48, text: "text-3xl", gap: "gap-3" },
  };
  const s = sizes[size];
  const textColor = variant === "light" ? "text-white" : "text-slate-900";

  return (
    <div className={`flex items-center ${s.gap}`}>
      {/* FUZE Shield Logo */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield shape */}
        <path
          d="M24 2L6 10v14c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V10L24 2z"
          fill="url(#fuze-gradient)"
          stroke={variant === "light" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)"}
          strokeWidth="1"
        />
        {/* F letterform */}
        <path
          d="M16 14h16v4H21v4h9v4h-9v8h-5V14z"
          fill="white"
        />
        {/* Accent line — antimicrobial wave */}
        <path
          d="M14 38c3-1 5-3 8-3s5 2 8 3"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <defs>
          <linearGradient id="fuze-gradient" x1="6" y1="2" x2="42" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${s.text} font-extrabold tracking-tight ${textColor}`}>
            FUZE
          </span>
          {size !== "sm" && (
            <span className={`text-[10px] font-medium tracking-widest uppercase ${variant === "light" ? "text-blue-300" : "text-blue-600"}`}>
              Atlas
            </span>
          )}
        </div>
      )}
    </div>
  );
}
