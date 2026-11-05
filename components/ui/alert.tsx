import React from "react";
import styles from "./alert.module.css";

export type AlertVariant = "success" | "error";

export type AlertProps = {
  readonly variant: AlertVariant;
  readonly title?: string;
  readonly children?: React.ReactNode;
  readonly className?: string;
};

export function Alert({ variant, title, children, className }: AlertProps) {
  const classes = [
    styles.alert,
    variant === "success" ? styles.success : styles.error,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} role={variant === "success" ? "status" : "alert"}>
      {title ? <p className={styles.title}>{title}</p> : null}
      {children}
    </div>
  );
}
