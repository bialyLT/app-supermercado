import React from "react";
import type { OperationsReportData } from "./types";
import { formatCurrencyAmount } from "./types";
import styles from "./reports.module.css";

export type ReportSummaryProps = {
  report: OperationsReportData;
};

export function ReportSummary({ report }: ReportSummaryProps) {
  const currency = report.currency;

  return (
    <section className={styles.summarySection} aria-labelledby="summary-heading">
      <div className={styles.sectionHeader}>
        <h2 id="summary-heading" className={styles.sectionTitle}>
          Resumen Consolidado de Operaciones
        </h2>
        <span className={styles.periodBadge}>
          Período: {new Date(report.period.from).toLocaleDateString()} —{" "}
          {new Date(report.period.to).toLocaleDateString()}
        </span>
      </div>

      <div className={styles.summaryCardsGrid}>
        {/* Ventas */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardHeader}>
            <h3 className={styles.summaryCardTitle}>Resumen de Ventas</h3>
          </div>
          <table className={styles.summaryTable}>
            <tbody>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Comprobantes emitidos</td>
                <td className={styles.summaryValue}>{report.sales.count}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Total facturado</td>
                <td className={styles.summaryValue}>
                  {formatCurrencyAmount(report.sales.total, currency)}
                </td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Unidades vendidas</td>
                <td className={styles.summaryValue}>{report.sales.quantity}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Compras */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardHeader}>
            <h3 className={styles.summaryCardTitle}>Resumen de Compras</h3>
          </div>
          <table className={styles.summaryTable}>
            <tbody>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Comprobantes recibidos</td>
                <td className={styles.summaryValue}>{report.purchases.count}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Total de compras</td>
                <td className={styles.summaryValue}>
                  {formatCurrencyAmount(report.purchases.total, currency)}
                </td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>IVA / Impuestos</td>
                <td className={styles.summaryValue}>
                  {formatCurrencyAmount(report.purchases.taxTotal, currency)}
                </td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Descuentos aplicados</td>
                <td className={styles.summaryValue}>
                  {formatCurrencyAmount(report.purchases.discountTotal, currency)}
                </td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Unidades ingresadas</td>
                <td className={styles.summaryValue}>{report.purchases.quantity}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Transferencias */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardHeader}>
            <h3 className={styles.summaryCardTitle}>Resumen de Transferencias</h3>
          </div>
          <table className={styles.summaryTable}>
            <tbody>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Despachos realizados</td>
                <td className={styles.summaryValue}>{report.transfers.count}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Unidades despachadas (salientes)</td>
                <td className={styles.summaryValue}>
                  {report.transfers.outQuantity}
                </td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Unidades recibidas (entrantes)</td>
                <td className={styles.summaryValue}>
                  {report.transfers.inQuantity}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Inventario */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryCardHeader}>
            <h3 className={styles.summaryCardTitle}>Resumen de Inventario</h3>
          </div>
          <table className={styles.summaryTable}>
            <tbody>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Líneas de stock activas</td>
                <td className={styles.summaryValue}>{report.stock.lineCount}</td>
              </tr>
              <tr className={styles.summaryRow}>
                <td className={styles.summaryKey}>Unidades on-hand totales</td>
                <td className={styles.summaryValue}>{report.stock.quantity}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
