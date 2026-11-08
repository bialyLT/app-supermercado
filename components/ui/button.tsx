import React from "react";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
};

export function Button({
  variant = "primary",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, VARIANT_CLASSES[variant], className]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}
