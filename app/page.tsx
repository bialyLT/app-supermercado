import { redirect } from "next/navigation";
import LoginForm from "../components/auth/login-form";
import { getHighestRole } from "../src/auth/roles";
import { getServerIdentity } from "../src/auth/session";
import styles from "./page.module.css";

export default async function HomePage() {
  let identity: Awaited<ReturnType<typeof getServerIdentity>> = null;
  try {
    identity = await getServerIdentity();
  } catch {
    identity = null;
  }

  const role = identity ? getHighestRole(identity.roles) : undefined;
  if (role === "CASHIER") redirect("/pos");
  else if (role) redirect("/admin");
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
