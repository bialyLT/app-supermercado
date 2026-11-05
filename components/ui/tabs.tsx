"use client";

import React, { useRef } from "react";
import styles from "./tabs.module.css";

export type TabItem = {
  readonly id: string;
  readonly label: string;
};

export type TabsProps = {
  readonly tabs: readonly TabItem[];
  readonly activeTabId: string;
  readonly onActivate: (id: string) => void;
  readonly ariaLabel?: string;
};

/* Pestañas accesibles: tablist/tab/tabpanel con roving tabindex,
   flechas Izq/Der + Home/End y activación con Enter o Espacio. */
export function Tabs({
  tabs,
  activeTabId,
  onActivate,
  ariaLabel = "Pestañas",
}: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex !== null) {
      event.preventDefault();
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div className={styles.tablist} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onActivate(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type TabPanelProps = {
  readonly id: string;
  readonly activeTabId: string;
  readonly children: React.ReactNode;
};

export function TabPanel({ id, activeTabId, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={activeTabId !== id}
    >
      {children}
    </div>
  );
}
