import "../login/login.css";

export default function SinAcceso() {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          Click Derecho
          <small>Sin acceso</small>
        </div>
        <p className="auth-hint">
          Tu cuenta existe pero todavía no está asociada a ningún estudio.
          Pedile a quien te invitó que te dé acceso, o escribinos.
        </p>
        <form action="/api/auth/logout" method="post">
          <button type="submit">Cerrar sesión</button>
        </form>
      </div>
    </div>
  );
}
