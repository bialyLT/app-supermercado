import React from "react";
import styles from "./page-header.module.css";

export type PageHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly actions?: React.ReactNode;
  readonly id?: string;
};

export function PageHeader({ title, description, actions, id }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.textBlock}>
        <h1 id={id} className={styles.title}>
          {title}
        </h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
