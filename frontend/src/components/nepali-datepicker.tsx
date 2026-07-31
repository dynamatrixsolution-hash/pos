"use client";

import React, { useEffect, useRef, useState } from "react";

interface NepaliDatePickerProps {
  value: string; // Always AD format (YYYY-MM-DD) from form state
  onChange: (adValue: string) => void; // Emits AD format (YYYY-MM-DD)
  className?: string;
  placeholder?: string;
}

export function convertBsToAd(bsDateStr: string): string {
  if (typeof window !== "undefined" && (window as any).NepaliFunctions) {
    try {
      const bsObj = (window as any).NepaliFunctions.ConvertToDateObject(bsDateStr, "YYYY-MM-DD");
      const adObj = (window as any).NepaliFunctions.BS2AD(bsObj);
      if (adObj) {
        const monthStr = String(adObj.month).padStart(2, "0");
        const dayStr = String(adObj.day).padStart(2, "0");
        return `${adObj.year}-${monthStr}-${dayStr}`;
      }
    } catch (e) {
      console.error("Failed to convert BS to AD:", e);
    }
  }
  return bsDateStr;
}

export function convertAdToBs(adDateStr: string): string {
  if (!adDateStr) return "";
  if (typeof window !== "undefined" && (window as any).NepaliFunctions) {
    try {
      const adObj = (window as any).NepaliFunctions.ConvertToDateObject(adDateStr, "YYYY-MM-DD");
      const bsObj = (window as any).NepaliFunctions.AD2BS(adObj);
      if (bsObj) {
        const monthStr = String(bsObj.month).padStart(2, "0");
        const dayStr = String(bsObj.day).padStart(2, "0");
        return `${bsObj.year}-${monthStr}-${dayStr}`;
      }
    } catch (e) {
      console.error("Failed to convert AD to BS:", e);
    }
  }
  return adDateStr;
}

export function NepaliDatePicker({
  value,
  onChange,
  className = "",
  placeholder = "Select Nepali Date (BS)",
}: NepaliDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState("");

  // Sync display value when value (AD) changes from parent
  useEffect(() => {
    if (value) {
      const bs = convertAdToBs(value);
      setDisplayValue(bs);
    } else {
      setDisplayValue("");
    }
  }, [value]);

  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;

    const initPicker = () => {
      if (typeof window !== "undefined" && (window as any).NepaliFunctions) {
        // Initialize if not already initialized
        const npPicker = (inputElement as any).nepaliDatePicker;
        if (!npPicker) {
          (window as any).NepaliDatePicker.Initialize(inputElement, {
            ndpYear: true,
            ndpMonth: true,
            ndpYearCount: 100,
            onChange: () => {
              if (inputElement) {
                const bsVal = inputElement.value;
                setDisplayValue(bsVal);
                const adVal = convertBsToAd(bsVal);
                onChange(adVal);
              }
            },
          });
        }
      }
    };

    // Retry initialization since scripts load asynchronously
    const interval = setInterval(() => {
      if ((window as any).NepaliFunctions && (window as any).NepaliDatePicker) {
        initPicker();
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [onChange]);

  return (
    <input
      type="text"
      ref={inputRef}
      value={displayValue}
      onChange={(e) => {
        const bsVal = e.target.value;
        setDisplayValue(bsVal);
        const adVal = convertBsToAd(bsVal);
        onChange(adVal);
      }}
      placeholder={placeholder}
      className={`w-full px-3 py-2 border border-border rounded-lg text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
    />
  );
}
