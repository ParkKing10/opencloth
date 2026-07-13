import loomLogo from '../../assets/loom-logo.png'

export function Logo() {
  return (
    <a className="brand" href="/" aria-label="loom studios Startseite">
      <img className="brand__logo" src={loomLogo} alt="loom studios" />
    </a>
  )
}
