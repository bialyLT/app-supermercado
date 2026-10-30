import LoginForm from "../components/auth/login-form";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="welcome-title">
          <p className={styles.eyebrow}>Supermercado · operación simple</p>
          <h1 className={styles.title} id="welcome-title">Supermercado</h1>
          <p className={styles.description}>
            Operaciones, stock y caja en un solo lugar. Una experiencia rápida para
            que el equipo pueda trabajar con claridad desde cualquier pantalla.
          </p>
          <ul className={styles.features}>
            <li>Stock y movimientos con trazabilidad</li>
            <li>Compras, transferencias y reportes operativos</li>
            <li>Accesos protegidos según cada rol</li>
          </ul>
        </section>

        <section className={styles.loginCard} aria-labelledby="login-title">
          <h2 className={styles.loginTitle} id="login-title">Ingresá a tu operación</h2>
          <p className={styles.loginDescription}>
            Usá tus credenciales para continuar al panel operativo.
          </p>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
