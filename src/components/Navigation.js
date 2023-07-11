import { useContext } from "react";
import { Link } from "react-router-dom";
import { NavContext } from "../contexts/NavContext";
import { UserContext } from "../contexts/UserContext";

const Navigation = () => {
  const { isNavActive, setIsNavActive } = useContext(NavContext);
  const { user } = useContext(UserContext);

  let accountButtons;
  if (user) {
    if (isNavActive) {
      accountButtons = (
        <>
          <Link to="/logout" className="navbar-item">
            Log Out
          </Link>
        </>
      );
    } else {
      accountButtons = (
        <>
          <div className="navbar-item pr-2">
            <Link to="/logout" className="button is-dark">
              Log Out
            </Link>
          </div>
        </>
      );
    }
  } else {
    if (isNavActive) {
      accountButtons = (
        <>
          <Link to="/register" className="navbar-item">
            Sign up
          </Link>
          <Link to="/login" className="navbar-item">
            Log in
          </Link>
        </>
      );
    } else {
      accountButtons = (
        <>
          <div className="navbar-item pr-2">
            <Link to="/register" className="button is-dark">
              Sign up
            </Link>
          </div>
          <div className="navbar-item pl-2">
            <Link to="/login" className="button is-dark is-outlined">
              Log in
            </Link>
          </div>
        </>
      );
    }
  }

  return (
    <nav
      className="navbar is-fixed-top"
      role="navigation"
      aria-label="navigation menu"
    >
      <div className="navbar-brand">
        <Link to="/">
          <img
            id="navigation-logo"
            alt="Logo"
            aria-label="Logo"
            src="https://storage.cloud.google.com/beneighborly.xyz/assets/logo-text.svg"
          />
        </Link>
        <button
          className={`navbar-burger ${isNavActive ? "is-active" : ""}`}
          aria-label="navigation menu dropdown"
          aria-expanded="false"
          data-target="navigation-menu"
          onClick={() => {
            setIsNavActive(!isNavActive);
          }}
        >
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
      </div>
      <div
        id="navigation-menu"
        className={`navbar-menu ${isNavActive ? "is-active" : ""}`}
      >
        <div className="navbar-end">
          <Link to="/" className="navbar-item">
            Home
          </Link>
          {user && (
            <Link to="/feed" className="navbar-item">
              Feed
            </Link>
          )}
          {accountButtons}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
