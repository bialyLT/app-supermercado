"use client";

import { cloneElement, isValidElement, useEffect, type ReactElement, type ReactNode, type RefObject } from "react";

type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

export type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  className?: string;
  children: ReactElement<FieldControlProps>;
};

export function Field({ id, label, required = false, helpText, error, className, children }: FieldProps) {
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement<FieldControlProps>(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={id}>
        {label}{required ? " *" : ""}
      </label>
      {control}
      {helpText ? <span id={helpId}>{helpText}</span> : null}
      {error ? <span id={errorId} role="alert">{error}</span> : null}
    </div>
  );
}

export function useFocusFirstInvalid<T extends HTMLElement>(
  formRef: RefObject<T | null>,
  errors: Record<string, string | undefined>,
) {
  useEffect(() => {
    if (!Object.values(errors).some(Boolean)) return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalid?.focus();
  }, [errors, formRef]);
}

export function FieldDescription({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}
