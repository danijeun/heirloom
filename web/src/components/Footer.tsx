import { useTheme } from "../useTheme";
import logo1 from "../assets/heirloom-logo1.png";
import logo2 from "../assets/heirloom-logo2.png";

const GITHUB_URL = "https://github.com/danijeun/heirloom";
const DEVPOST_URL = "https://devpost.com/software/heirloom-jvcg3a";

export function Footer() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? logo2 : logo1;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer-inner">
        <a className="site-footer-brand" href="/" aria-label="Heirloom home">
          <img src={logoSrc} alt="Heirloom" className="site-footer-logo" />
          <span className="site-footer-tagline">
            A living dictionary for dying family languages.
          </span>
        </a>

        <ul className="site-footer-socials" aria-label="Project links">
          <li>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Heirloom on GitHub"
              className="site-footer-social"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5Z"/>
              </svg>
            </a>
          </li>
          <li>
            <a
              href={DEVPOST_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Heirloom on Devpost"
              className="site-footer-social"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M6.002 1.61 0 12.004 6.002 22.39h11.996L24 12.004 17.998 1.61H6.002Zm1.593 4.084h3.947c3.605 0 6.276 1.695 6.276 6.31 0 4.436-3.21 6.302-6.456 6.302H7.595V5.694Zm2.517 2.449v7.714h1.241c2.646 0 3.862-1.55 3.862-3.861.009-2.569-1.096-3.853-3.767-3.853h-1.336Z"/>
              </svg>
            </a>
          </li>
        </ul>
      </div>

      <div className="site-footer-bottom">
        <span>© {year} Heirloom. Humans create. Claude preserves.</span>
      </div>
    </footer>
  );
}
