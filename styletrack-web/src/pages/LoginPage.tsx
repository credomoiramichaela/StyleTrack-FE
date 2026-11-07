import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon } from '../ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <svg className="login-mirrors" viewBox="0 0 600 420" preserveAspectRatio="xMidYMin slice" fill="none" stroke="#d9b97f" strokeWidth="2.5">
          <rect x="40" y="30" width="110" height="260" rx="55" fill="#ffe9bd22" />
          <rect x="190" y="70" width="90" height="220" rx="45" fill="#ffe9bd1a" />
          <rect x="320" y="110" width="70" height="180" rx="35" fill="#ffe9bd14" />
          <path d="M0 330h600" stroke="#ffffff22" />
          <path d="M70 290c30-60 90-70 150-10M300 290c20-40 70-50 110-10" stroke="#ffffff30" />
        </svg>
        <div className="login-copy">
          <p className="login-kicker">A modern salon experience</p>
          <p className="login-tag">More Than Beauty, <em>Better You.</em></p>
          <div className="login-rule" />
          <p>Manage. Grow. Create Beautiful Experiences.<br />All in One Place.</p>
        </div>
      </div>
      <div className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-logo"><b>Jonathan Hair Studio</b><span>Salon Management System</span></div>
          <h1>Sign In</h1>
          <p className="welcome">Welcome back!</p>
          <p className="sub">Log in to manage your salon, clients, appointments and more with Jonathan Hair Studio.</p>
          <label className="field">
            <span className="field-label">Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <span className="pw">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name="eye" /></button>
            </span>
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Login  →'}</button>
          <p className="login-foot">Trouble signing in? Ask the salon owner to reset your login.</p>
        </form>
      </div>
    </div>
  );
}
