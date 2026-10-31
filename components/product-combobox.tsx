"use client";

import { useId, useRef, useState } from "react";
import styles from "./product-combobox.module.css";

export type ProductComboboxOption = {
  id: string;
  sku: string;
  name: string;
  productName: string;
};

type ProductComboboxProps = {
  id?: string;
  value: string;
  options: ProductComboboxOption[];
  isLoading?: boolean;
  disabled?: boolean;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSelect: (option: ProductComboboxOption) => void;
  onFocus?: () => void;
  inputClassName?: string;
  listClassName?: string;
  noResultsText?: string;
  autoFocus?: boolean;
};

export function ProductCombobox({
  id,
  value,
  options,
  isLoading = false,
  disabled = false,
  label,
  placeholder,
  onChange,
  onSelect,
  onFocus,
  inputClassName,
  listClassName,
  noResultsText = "Sin coincidencias",
  autoFocus = false,
}: ProductComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const hasOptions = options.length > 0;
  const showList = isOpen && (isLoading || hasOptions || value.trim().length > 0);

  function selectAt(index: number) {
    const option = options[index];
    if (!option) return;
    onSelect(option);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, options.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectAt(activeIndex);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={styles.root}>
      <label className={styles.srOnly} htmlFor={inputId}>{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
        onChange={(event) => {
          setIsOpen(true);
          setActiveIndex(-1);
          onChange(event.target.value);
        }}
        onFocus={() => {
          setIsOpen(true);
          onFocus?.();
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 0)}
      />
      <div className={styles.liveRegion} role="status" aria-live="polite">
        {isLoading ? "Buscando en catálogo…" : showList && hasOptions ? `${options.length} resultado(s)` : ""}
      </div>
      {showList && (
        <ul id={listId} className={listClassName ?? styles.list} role="listbox" aria-label={`${label} resultados`}>
          {isLoading ? (
            <li className={styles.option} role="status">Buscando en catálogo…</li>
          ) : hasOptions ? (
            options.map((option, index) => (
              <li
                id={`${listId}-option-${index}`}
                key={option.id}
                className={`${styles.option} ${index === activeIndex ? styles.activeOption : ""}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectAt(index)}
              >
                <strong>{option.sku}</strong> — {option.productName} ({option.name})
              </li>
            ))
          ) : (
            <li className={styles.option} role="status">{noResultsText}</li>
          )}
        </ul>
      )}
    </div>
  );
}
