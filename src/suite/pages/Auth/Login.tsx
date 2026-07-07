import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth'
import { DEMO_CREDENTIALS } from '../../data/seed'
import { AuthBrand } from './AuthBrand'
import './auth-screen.css'

type LocationState = { from?: string }

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from ?? '/suite'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent, creds?: { email: string; password: string }) {
    e.preventDefault()
    const em = creds?.email ?? email
    const pw = creds?.password ?? password
    setBusy(true)
    setError('')
    const res = await login(em, pw)
    setBusy(false)
    if (res.ok) navigate(from, { replace: true })
    else setError(res.error ?? 'Could not sign in.')
  }

  function fillDemo(role: 'user' | 'admin') {
    const creds = DEMO_CREDENTIALS[role]
    setEmail(creds.email)
    setPassword(creds.password)
    void submit(new Event('submit') as unknown as FormEvent, creds)
  }

  return (
    <div className="suite">
      <div className="auth">
        <AuthBrand />
        <main className="auth__panel">
          <Link className="auth__back" to="/">
            ← Back to site
          </Link>
          <div className="auth__card">
            <h1 className="auth__title">Welcome back</h1>
            <p className="auth__sub">Sign in to your THREADOS workspace.</p>

            <form className="auth__form" onSubmit={(e) => submit(e)}>
              <div className="auth__field">
                <label className="auth__label" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  className="auth__input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@brand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth__field">
                <label className="auth__label" htmlFor="login-pw">
                  Password
                </label>
                <input
                  id="login-pw"
                  className="auth__input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <div className="auth__error">{error}</div>}

              <button className="auth__submit" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="auth__demo">
              <div className="auth__demo-head">Try a demo account</div>
              <div className="auth__demo-row">
                <button className="auth__demo-btn" type="button" onClick={() => fillDemo('user')}>
                  Creator
                </button>
                <button className="auth__demo-btn" type="button" onClick={() => fillDemo('admin')}>
                  Admin
                </button>
              </div>
            </div>

            <p className="auth__alt">
              Don't have an account? <Link to="/signup">Create one</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
