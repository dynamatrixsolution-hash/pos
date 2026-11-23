"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Star, Shuffle, ExternalLink, Copy, Check } from "lucide-react";
import { AllowedReviewRating, pickShuffledReview } from "../review-templates";

interface GoogleReviewCardProps {
  publicCode: string;
  businessName: string;
  initialReviewUrl?: string | null;
}

export function GoogleReviewCard({
  publicCode,
  businessName,
  initialReviewUrl,
}: GoogleReviewCardProps) {
  const [reviewUrl, setReviewUrl] = useState<string | null>(initialReviewUrl || null);
  const [rating, setRating] = useState<AllowedReviewRating>(5);
  const [comment, setComment] = useState<string>("");
  const [lastIdx, setLastIdx] = useState<number | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  // Fetch owner's live Google Business Profile link via dedicated lightweight API
  useEffect(() => {
    if (initialReviewUrl) {
      setReviewUrl(initialReviewUrl);
    }
    let cancelled = false;
    fetch(`/api/v1/guest/review-link?publicCode=${encodeURIComponent(publicCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.googleReviewUrl) {
          setReviewUrl(data.googleReviewUrl);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [publicCode, initialReviewUrl]);

  const shuffle = useCallback(
    (targetRating: AllowedReviewRating = rating) => {
      const picked = pickShuffledReview(targetRating, businessName, lastIdx);
      setLastIdx(picked.index);
      setComment(picked.text);
    },
    [rating, businessName, lastIdx]
  );

  // Initialize with a shuffled 5-star review on mount
  useEffect(() => {
    const picked = pickShuffledReview(5, businessName);
    setLastIdx(picked.index);
    setComment(picked.text);
  }, [businessName]);

  if (!reviewUrl) return null;

  const handleSelectRating = (stars: AllowedReviewRating) => {
    setRating(stars);
    shuffle(stars);
  };

  const handleCopyAndOpen = async () => {
    try {
      if (comment.trim() && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(comment.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // Clipboard may be blocked on non-HTTPS dev contexts; still open review URL
    }
    window.open(reviewUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#292320]">Enjoyed Your Visit?</h3>
          <p className="text-xs text-[#71675E] mt-0.5">
            Pick a rating, customize or shuffle a quick review, and post it on Google.
          </p>
        </div>
        <button
          type="button"
          onClick={() => shuffle(rating)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[11px] font-semibold text-[#292320] transition-colors cursor-pointer shrink-0"
          title="Shuffle another prepared review"
        >
          <Shuffle className="w-3.5 h-3.5 text-[#6B2837]" />
          <span>Shuffle</span>
        </button>
      </div>

      {/* 3, 4, or 5 Star Selector (minimum 3 stars) */}
      <div className="flex items-center gap-2">
        {([3, 4, 5] as AllowedReviewRating[]).map((stars) => {
          const active = rating === stars;
          return (
            <button
              key={stars}
              type="button"
              onClick={() => handleSelectRating(stars)}
              className={`flex-1 h-9 rounded-md border text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                active
                  ? "bg-[#6B2837] border-[#6B2837] text-[#FFFCF7]"
                  : "bg-[#F7F3EC] border-[#D8CEC1] text-[#292320] hover:bg-[#EEE7DD]"
              }`}
              aria-pressed={active}
            >
              <span className="tabular-nums">{stars}</span>
              <Star
                className={`w-3.5 h-3.5 ${
                  active ? "text-[#F3E5AB] fill-[#F3E5AB]" : "text-[#A77B38] fill-[#A77B38]"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Editable Review Comment */}
      <div>
        <label htmlFor="guest-google-review" className="sr-only">
          Your review comment
        </label>
        <textarea
          id="guest-google-review"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write or edit your review..."
          className="w-full rounded-md border border-[#D8CEC1] bg-[#F7F3EC] px-3 py-2 text-xs text-[#292320] placeholder:text-[#71675E] focus:outline-none focus:bg-[#FFFCF7] focus:border-[#6B2837] resize-none leading-relaxed"
        />
      </div>

      <button
        type="button"
        onClick={handleCopyAndOpen}
        className="w-full h-10 rounded-md bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            <span>Copied! Opening Google Review...</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>Copy &amp; Post on Google</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </>
        )}
      </button>
    </section>
  );
}
