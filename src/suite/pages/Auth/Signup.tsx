import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/auth'
import { AuthBrand } from './AuthBrand'
import './auth-screen.css'

export function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const strength = password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Good' : password ? 'Too short' : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await signup(name, email, password)
    setBusy(false)
    if (res.ok) navigate('/suite', { replace: true })
    else setError(res.error ?? 'Could not create your account.')
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
            <h1 className="auth__title">Create your account</h1>
            <p className="auth__sub">Start designing in minutes — no design skills needed.</p>

            <form className="auth__form" onSubmit={submit}>
              <div className="auth__field">
                <label className="auth__label" htmlFor="su-name">
                  Full name
                </label>
                <input
                  id="su-name"
                  className="auth__input"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="auth__field">
                <label className="auth__label" htmlFor="su-email">
                  Email
                </label>
                <input
                  id="su-email"
                  className="auth__input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@brand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth__field">
                <label className="auth__label" htmlFor="su-pw">
                  Password
                </label>
                <input
                  id="su-pw"
                  className="auth__input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {strength && <span className="auth__hint">Password strength: {strength}</span>}
              </div>

              {error && <div className="auth__error">{error}</div>}

              <button className="auth__submit" type="submit" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="auth__alt">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
