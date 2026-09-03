"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
export function Modal({ title, eyebrow, description, onClose, children, busy = false }: { title: string; eyebrow: string; description: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = rootRef.current;
    if (!root) return;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(node => !node.hidden && node.getClientRects().length > 0);
    (focusable()[0] ?? root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // The open listbox owns Escape; only a second Escape closes the dialog.
      if (event.key === "Escape" && event.target instanceof Element && event.target.closest('[role="listbox"]')) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busyRef.current) closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const nodes = focusable(), first = nodes[0], last = nodes.at(-1);
      if (!first || !last) { event.preventDefault(); root.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
      else { const heading = document.querySelector<HTMLElement>("main h1"); heading?.setAttribute("tabindex", "-1"); heading?.focus(); }
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section className="entry-modal" ref={rootRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} aria-busy={busy}>
      <div className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar">×</button></div>
      {children}
    </section>
  </div>;
}
