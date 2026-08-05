"use client";

import { createPortal } from "react-dom";
import { KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";

export type SelectOption = { value: string; label: string; description?: string };

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  variant?: "light" | "dark";
};

type MenuPosition = { top: number; left: number; width: number };

export function SelectMenu({ value, options, onChange, ariaLabel, placeholder = "Selecione", disabled = false, variant = "light" }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);

  const positionMenu = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuHeight = Math.min(options.length * 48 + 12, 280);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 16 && rect.top > spaceBelow;
    setPosition({
      top: openUp ? Math.max(8, rect.top - menuHeight - 7) : rect.bottom + 7,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
    });
  }, [options.length]);

  function close(focusButton = false) {
    setOpen(false);
    if (focusButton) window.requestAnimationFrame(() => buttonRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const handleLayout = () => positionMenu();
    document.addEventListener("pointerdown", handlePointer);
    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);
    window.requestAnimationFrame(() => {
      const selectedOption = menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      (selectedOption ?? menuRef.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
    };
  }, [open, positionMenu]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); items[(current + 1) % items.length]?.focus(); }
    if (event.key === "ArrowUp") { event.preventDefault(); items[(current - 1 + items.length) % items.length]?.focus(); }
    if (event.key === "Home") { event.preventDefault(); items[0]?.focus(); }
    if (event.key === "End") { event.preventDefault(); items.at(-1)?.focus(); }
  }

  return <>
    <button
      ref={buttonRef}
      type="button"
      className={`select-menu-trigger ${variant} ${open ? "open" : ""}`}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      disabled={disabled}
      onClick={() => { if (!open) positionMenu(); setOpen((current) => !current); }}
      onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setOpen(true); }
        if (event.key === "Escape") close();
      }}
    >
      <span className={!selected ? "placeholder" : ""}>{selected?.label ?? placeholder}</span>
      <span className="select-menu-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && typeof document !== "undefined" && createPortal(
      <div ref={menuRef} id={listboxId} className={`select-menu-popover ${variant}`} role="listbox" aria-label={ariaLabel} style={position} onKeyDown={handleMenuKeyDown}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); close(true); }}>
          <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
          {option.value === value && <b aria-hidden="true">✓</b>}
        </button>)}
      </div>,
      document.body,
    )}
  </>;
}
