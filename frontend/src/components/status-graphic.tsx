"use client";

import React from "react";

interface StatusGraphicProps {
  badgeText?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function StatusGraphic({
  badgeText = "404 lost",
  className = "",
  size = "md",
}: StatusGraphicProps) {
  const containerSize =
    size === "sm"
      ? "w-48 h-48 sm:w-56 sm:h-56 p-4"
      : size === "lg"
      ? "w-72 h-72 sm:w-80 sm:h-80 p-8"
      : "w-64 h-64 sm:w-72 sm:h-72 p-6";

  const svgSize = size === "sm" ? "w-20 h-20" : size === "lg" ? "w-32 h-32" : "w-28 h-28";

  return (
    <div
      className={`relative rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-center overflow-hidden ${containerSize} ${className}`}
    >
      {/* Background radar / coordinate rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <div
          className="w-56 h-56 rounded-full border border-dashed border-[#D8CEC1] animate-spin"
          style={{ animationDuration: "40s" }}
        />
        <div className="absolute w-40 h-40 rounded-full border border-[#D8CEC1]" />
        <div className="absolute w-24 h-24 rounded-full border border-[#D8CEC1]" />
      </div>

      {/* Floating animated rocket / beacon ship */}
      <div
        className="relative flex flex-col items-center z-10 animate-bounce"
        style={{ animationDuration: "3s" }}
      >
        {/* Status Speech Bubble */}
        {badgeText && (
          <div className="absolute -top-10 -right-8 bg-[#292320] text-[#FFFCF7] px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase border border-[#71675E] shadow-xs select-none">
            {badgeText}
          </div>
        )}

        {/* Vector Rocket Graphic with crisp stroke and hospitality burgundy theme */}
        <svg
          className={`${svgSize} text-[#6B2837]`}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Rocket Body */}
          <path
            d="M50 12 C40 28 35 48 35 68 L65 68 C65 48 60 28 50 12 Z"
            fill="#FFFCF7"
            stroke="#292320"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Nose Cone */}
          <path
            d="M50 12 C45 22 41 30 40 36 L60 36 C59 30 55 22 50 12 Z"
            fill="#6B2837"
            stroke="#292320"
            strokeWidth="3"
          />
          {/* Porthole */}
          <circle
            cx="50"
            cy="48"
            r="8"
            fill="#EEE7DD"
            stroke="#292320"
            strokeWidth="3"
          />
          {/* Left Fin */}
          <path
            d="M35 52 L22 66 C21 75 32 74 35 68 Z"
            fill="#A77B38"
            stroke="#292320"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Right Fin */}
          <path
            d="M65 52 L78 66 C79 75 68 74 65 68 Z"
            fill="#A77B38"
            stroke="#292320"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Engine Thruster Base */}
          <path
            d="M42 68 L58 68 L55 74 L45 74 Z"
            fill="#71675E"
            stroke="#292320"
            strokeWidth="2.5"
          />
          {/* Animated Exhaust Flame */}
          <path
            className="animate-pulse"
            d="M46 75 Q50 88 54 75 Z"
            fill="#B33432"
            stroke="#292320"
            strokeWidth="2"
          />
        </svg>

        {/* Particle motion trails */}
        <div className="flex gap-2 mt-1 opacity-70">
          <span
            className="w-1 h-3 bg-[#71675E] rounded-full animate-ping"
            style={{ animationDuration: "1.5s" }}
          />
          <span
            className="w-1 h-4 bg-[#6B2837] rounded-full animate-ping"
            style={{ animationDuration: "1s" }}
          />
          <span
            className="w-1 h-3 bg-[#71675E] rounded-full animate-ping"
            style={{ animationDuration: "1.8s" }}
          />
        </div>
      </div>

      {/* Decorative celestial icons */}
      <div className="absolute top-4 left-4 w-4 h-4 rounded-full bg-[#EEE7DD] border border-[#D8CEC1]" />
      <div className="absolute bottom-6 right-6 w-5 h-5 rounded-full bg-[#EEE7DD] border border-[#D8CEC1]" />
      <div className="absolute top-8 right-10 w-2 h-2 rounded-full bg-[#A77B38]" />
    </div>
  );
}

