"use client";

import { FormEvent, useState } from "react";

function authenticationMessage(error?: string) {
  if (error === "google_unavailable") return "O acesso com Google está temporariamente indisponível.";
  if (error === "invalid_callback") return "Não foi possível concluir a autenticação. Tente novamente.";
  return "";
}

export function SignInScreen({ authError }: { authError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(() => authenticationMessage(authError));
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as { message?: string; error?: string; redirectTo?: string };
      if (!response.ok) {
        setMessage(result.error ?? "N\u00e3o foi poss\u00edvel entrar.");
        return;
      }
      window.location.assign(result.redirectTo ?? "/");
    } catch {
      setMessage("N\u00e3o foi poss\u00edvel conectar ao servidor. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <div className="auth-brand"><span className="brand-mark">H</span><span><strong>horus</strong><small>HORAS T&Eacute;CNICAS</small></span></div>
        <span className="eyebrow">ACESSO PROTEGIDO</span>
        <h1 id="sign-in-title">Entre no Horus</h1>
        <p>Use o e-mail autorizado pela sua organiza&ccedil;&atilde;o e sua senha de acesso.</p>
        <form onSubmit={submit}>
          <label className="field">E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com.br" required /></label>
          <label className="field auth-password-field">Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} placeholder="Sua senha" required /></label>
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? "Entrando..." : "Entrar"}</button>
        </form>
        <div className="auth-divider"><span>ou</span></div>
        <form action="/api/auth/google" method="post">
          <button className="google-button" type="submit"><span aria-hidden="true">G</span>Continuar com Google</button>
        </form>
        {message && <div className="auth-message" role="status">{message}</div>}
        <small className="auth-footnote">O acesso depende de cadastro ativo no Horus. A senha inicial \u00e9 fornecida pelo RH.</small>
      </section>
    </main>
  );
}

export function AccessDeniedScreen() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="access-denied-title">
        <div className="auth-brand"><span className="brand-mark">H</span><span><strong>horus</strong><small>HORAS T&Eacute;CNICAS</small></span></div>
        <span className="eyebrow">ACESSO N&Atilde;O LIBERADO</span>
        <h1 id="access-denied-title">Seu cadastro n&atilde;o est&aacute; ativo</h1>
        <p>Pe&ccedil;a ao RH para cadastrar este e-mail na organiza&ccedil;&atilde;o e tente novamente.</p>
        <form action="/api/auth/sign-out" method="post"><button className="secondary-button" type="submit">Sair e usar outro e-mail</button></form>
      </section>
    </main>
  );
}
