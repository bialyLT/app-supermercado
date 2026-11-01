"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./modal.module.css";

type ModalProps = {
  ariaLabelledBy: string;
  children?: ReactNode;
  closeDisabled?: boolean;
  onRequestClose: () => void;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

export function Modal({ ariaLabelledBy, children, closeDisabled = false, onRequestClose }: ModalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = rootRef.current;
    const parent = root?.parentElement;
    const siblings = parent ? Array.from(parent.children).filter((child) => child !== root) : [];
    const inertStates = siblings.map((sibling) => ({ sibling, inert: sibling instanceof HTMLElement ? sibling.inert : false }));

    siblings.forEach((sibling) => {
      if (sibling instanceof HTMLElement) sibling.inert = true;
    });

    const focusFirst = () => {
      const focusable = root?.querySelector<HTMLElement>(focusableSelector);
      focusable?.focus();
    };
    queueMicrotask(focusFirst);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!closeDisabled) {
          event.preventDefault();
          onRequestClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = root ? Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)) : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      inertStates.forEach(({ sibling, inert }) => {
        if (sibling instanceof HTMLElement) sibling.inert = inert;
      });
      previousActiveRef.current?.focus();
    };
  }, [closeDisabled, onRequestClose]);

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.backdrop} aria-hidden="true" onClick={() => { if (!closeDisabled) onRequestClose(); }} />
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy}>
        {children}
      </div>
    </div>
  );
}
