import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useT, LanguageToggle } from '@/i18n'
import { useAuth } from '../../auth/auth'
import { AuthBrand } from './AuthBrand'
import './auth-screen.css'

export function Signup() {
  const t = useT()
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const strength = password.length >= 12 ? 'strong' : password.length >= 8 ? 'good' : password ? 'short' : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await signup(name, email, password)
    setBusy(false)
    if (res.ok) {
      // Fresh account: the shell shows the trial/plan modal first, then starts the app tour.
      localStorage.setItem('threados-post-signup', '1')
      navigate('/', { replace: true })
    } else setError(res.error ?? t('auth.err.couldNotCreate'))
  }

  return (
    <div className="suite">
      <div className="auth">
        <AuthBrand />
        <main className="auth__panel">
          <Link className="auth__back" to="/">
            ← {t('auth.backToSite')}
          </Link>
          <LanguageToggle variant="ghost" />
          <div className="auth__card">
            <h1 className="auth__title">{t('auth.signup.title')}</h1>
            <p className="auth__sub">{t('auth.signup.sub')}</p>

            <form className="auth__form" onSubmit={submit}>
              <div className="auth__field">
                <label className="auth__label" htmlFor="su-name">
                  {t('auth.field.fullName')}
                </label>
                <input
                  id="su-name"
                  className="auth__input"
                  type="text"
                  autoComplete="name"
                  placeholder={t('auth.field.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="auth__field">
                <label className="auth__label" htmlFor="su-email">
                  {t('auth.field.email')}
                </label>
                <input
                  id="su-email"
                  className="auth__input"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.field.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth__field">
                <label className="auth__label" htmlFor="su-pw">
                  {t('auth.field.password')}
                </label>
                <input
                  id="su-pw"
                  className="auth__input"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('auth.field.pwPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {strength && (
                  <span className="auth__hint">
                    {t('auth.signup.strengthLabel', { level: t(`auth.strength.${strength}`) })}
                  </span>
                )}
              </div>

              {error && <div className="auth__error">{error}</div>}

              <button className="auth__submit" type="submit" disabled={busy}>
                {busy ? t('auth.signup.busy') : t('auth.signup.submit')}
              </button>
            </form>

            <p className="auth__alt">
              {t('auth.signup.haveAccount')}
              <Link to="/login">{t('auth.signup.signIn')}</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
