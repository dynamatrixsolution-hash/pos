"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GuestSplashScreenProps {
  businessName?: string;
  locationLabel?: string;
  publicCode: string;
}

export function GuestSplashScreen({
  businessName,
  locationLabel,
  publicCode,
}: GuestSplashScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `restroinn_splash_shown_${publicCode}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // proceed
    }

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1050);
    return () => clearTimeout(timer);
  }, [publicCode]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.32, ease: "easeOut" } }}
          className="fixed inset-0 z-[100] bg-[#6B2837] text-[#FFFCF7] flex flex-col items-center justify-center px-6 select-none"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center space-y-4"
          >
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#FFFCF7]/25 bg-[#FFFCF7] p-1">
              <img
                src="/icons/icon-192.png"
                alt="RestroInn"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-extrabold tracking-tight text-[#FFFCF7]">
                {businessName || "RestroInn"}
              </h1>
              <p className="text-xs font-medium tracking-wider uppercase text-[#F3E5AB]">
                {locationLabel || "Digital Dining Menu"}
              </p>
            </div>

            <div className="w-28 h-1 rounded-full bg-[#FFFCF7]/20 overflow-hidden mt-2">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 0.85, ease: "easeInOut" }}
                className="h-full w-full bg-[#F3E5AB] rounded-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
