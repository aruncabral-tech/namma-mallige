"use client";

import { useEffect, useState } from "react";
import { APP_HEADLINE } from "@/lib/account-types";

/** Decorative, once per page opening. App loading continues underneath. */
export function OpeningAnimation() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dismiss = () => setVisible(false);
    const onMotionChange = () => { if (motion.matches) dismiss(); };
    if (motion.matches) dismiss();
    // CSS also hides the overlay on its own if JavaScript loads slowly.
    const timer = window.setTimeout(dismiss, 1800);
    window.addEventListener("pointerdown", dismiss, { once: true });
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("focusin", dismiss, { once: true });
    motion.addEventListener("change", onMotionChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("focusin", dismiss);
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  if (!visible) return null;
  return <div
    className="app-opening"
    aria-hidden="true"
    onAnimationEnd={event => {
      if (event.target === event.currentTarget) setVisible(false);
    }}
  >
    <div className="app-opening-content">
      <img className="app-opening-logo" src="/brand-logo.png" alt="" width="380" height="380" fetchPriority="high" decoding="async" />
      <p className="app-opening-headline">{APP_HEADLINE}</p>
    </div>
  </div>;
}
