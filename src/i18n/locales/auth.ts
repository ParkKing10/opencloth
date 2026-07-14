import type { LocaleBundle } from '../types'

// Translations for the "auth" area. Keep en + de keys in sync.
export const auth: LocaleBundle = {
  en: {
    // Shared
    'auth.backToSite': 'Back to site',
    'auth.field.email': 'Email',
    'auth.field.emailPlaceholder': 'you@brand.com',
    'auth.field.password': 'Password',
    'auth.field.fullName': 'Full name',
    'auth.field.namePlaceholder': 'Your name',
    'auth.field.pwPlaceholder': 'At least 8 characters',
    'auth.loading': 'Loading',

    // Login
    'auth.login.title': 'Welcome back',
    'auth.login.sub': 'Sign in to your loom studios workspace.',
    'auth.login.busy': 'Signing in…',
    'auth.login.submit': 'Sign in',
    'auth.login.demoHead': 'Try a demo account',
    'auth.login.demoCreator': 'Creator',
    'auth.login.demoAdmin': 'Admin',
    'auth.login.noAccount': "Don't have an account? ",
    'auth.login.createOne': 'Create one',

    // Signup
    'auth.signup.title': 'Create your account',
    'auth.signup.sub': 'Start designing in minutes — no design skills needed.',
    'auth.signup.busy': 'Creating account…',
    'auth.signup.submit': 'Create account',
    'auth.signup.haveAccount': 'Already have an account? ',
    'auth.signup.signIn': 'Sign in',
    'auth.signup.strengthLabel': 'Password strength: {level}',
    'auth.strength.strong': 'Strong',
    'auth.strength.good': 'Good',
    'auth.strength.short': 'Too short',

    // Brand panel
    'auth.brand.headline1': 'The operating system for ',
    'auth.brand.headline2': 'fashion brands.',
    'auth.brand.pitch': 'Design, produce and launch your collection — from first idea to production, all in one place.',
    'auth.brand.creators': 'Creators',
    'auth.brand.designs': 'Designs',
    'auth.brand.manufacturers': 'Manufacturers',

    // Errors + status messages
    'auth.err.invalidLogin': 'Incorrect email or password.',
    'auth.err.emailExists': 'An account with that email already exists.',
    'auth.err.emailNotConfirmed': 'Please confirm your email, then sign in.',
    'auth.err.tooMany': 'Too many attempts — please wait a moment and try again.',
    'auth.err.pwTooShort': 'Password must be at least 8 characters.',
    'auth.err.generic': 'Something went wrong. Please try again.',
    'auth.err.validEmail': 'Enter a valid email address.',
    'auth.err.enterPassword': 'Enter your password.',
    'auth.err.suspended': 'This account has been suspended.',
    'auth.err.noAccount': 'No account found for that email.',
    'auth.err.incorrectPassword': 'Incorrect password.',
    'auth.err.enterName': 'Enter your name.',
    'auth.err.confirmEmail': 'Check your email to confirm your account, then sign in.',
    'auth.err.couldNotSignIn': 'Could not sign in.',
    'auth.err.couldNotCreate': 'Could not create your account.',
  },
  de: {
    // Shared
    'auth.backToSite': 'Zurück zur Website',
    'auth.field.email': 'E-Mail',
    'auth.field.emailPlaceholder': 'du@marke.com',
    'auth.field.password': 'Passwort',
    'auth.field.fullName': 'Vollständiger Name',
    'auth.field.namePlaceholder': 'Dein Name',
    'auth.field.pwPlaceholder': 'Mindestens 8 Zeichen',
    'auth.loading': 'Wird geladen',

    // Login
    'auth.login.title': 'Willkommen zurück',
    'auth.login.sub': 'Melde dich in deinem loom studios Workspace an.',
    'auth.login.busy': 'Wird angemeldet…',
    'auth.login.submit': 'Anmelden',
    'auth.login.demoHead': 'Demo-Konto ausprobieren',
    'auth.login.demoCreator': 'Creator',
    'auth.login.demoAdmin': 'Admin',
    'auth.login.noAccount': 'Noch kein Konto? ',
    'auth.login.createOne': 'Erstelle eins',

    // Signup
    'auth.signup.title': 'Erstelle dein Konto',
    'auth.signup.sub': 'Starte in wenigen Minuten mit dem Designen — keine Designkenntnisse nötig.',
    'auth.signup.busy': 'Konto wird erstellt…',
    'auth.signup.submit': 'Konto erstellen',
    'auth.signup.haveAccount': 'Bereits ein Konto? ',
    'auth.signup.signIn': 'Anmelden',
    'auth.signup.strengthLabel': 'Passwortstärke: {level}',
    'auth.strength.strong': 'Stark',
    'auth.strength.good': 'Gut',
    'auth.strength.short': 'Zu kurz',

    // Brand panel
    'auth.brand.headline1': 'Das Betriebssystem für ',
    'auth.brand.headline2': 'Modemarken.',
    'auth.brand.pitch': 'Entwirf, produziere und launche deine Kollektion — von der ersten Idee bis zur Produktion, alles an einem Ort.',
    'auth.brand.creators': 'Creator',
    'auth.brand.designs': 'Designs',
    'auth.brand.manufacturers': 'Hersteller',

    // Errors + status messages
    'auth.err.invalidLogin': 'Falsche E-Mail-Adresse oder falsches Passwort.',
    'auth.err.emailExists': 'Es existiert bereits ein Konto mit dieser E-Mail-Adresse.',
    'auth.err.emailNotConfirmed': 'Bitte bestätige deine E-Mail-Adresse und melde dich dann an.',
    'auth.err.tooMany': 'Zu viele Versuche — bitte warte einen Moment und versuche es erneut.',
    'auth.err.pwTooShort': 'Das Passwort muss mindestens 8 Zeichen lang sein.',
    'auth.err.generic': 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    'auth.err.validEmail': 'Gib eine gültige E-Mail-Adresse ein.',
    'auth.err.enterPassword': 'Gib dein Passwort ein.',
    'auth.err.suspended': 'Dieses Konto wurde gesperrt.',
    'auth.err.noAccount': 'Kein Konto für diese E-Mail-Adresse gefunden.',
    'auth.err.incorrectPassword': 'Falsches Passwort.',
    'auth.err.enterName': 'Gib deinen Namen ein.',
    'auth.err.confirmEmail': 'Prüfe deine E-Mails, um dein Konto zu bestätigen, und melde dich dann an.',
    'auth.err.couldNotSignIn': 'Anmeldung nicht möglich.',
    'auth.err.couldNotCreate': 'Konto konnte nicht erstellt werden.',
  },
}
