import React from "react";
import styles from "./empty-state.module.css";

export type EmptyStateProps = {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionHref?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className={styles.container} role="region" aria-label={title}>
      <div className={styles.iconCircle} aria-hidden="true">
        📋
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {actionLabel && (
        <div className={styles.actions}>
          {actionHref ? (
            <a href={actionHref} className={styles.actionButton}>
              {actionLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className={styles.actionButton}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
