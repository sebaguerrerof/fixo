"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface RevealProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  /** Stagger in milliseconds. */
  readonly delay?: number;
}

type RevealState = "server" | "armed" | "visible";

/**
 * Fades content in when it enters the viewport.
 * The server renders it fully visible. Only after mounting, and only if the block is still below the fold
 * and IntersectionObserver exists, is it armed (hidden) and then revealed. If scripts fail, stay disabled,
 * or the user prefers reduced motion, the content is simply visible.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("server");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) { setState("visible"); return; }
    setState("armed");
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setState("visible"); observer.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("reveal", className)} data-armed={state !== "server"} data-visible={state === "visible"} ref={ref} style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}
