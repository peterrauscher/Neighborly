import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../contexts/user.context";
import logo from "../images/logo-text.png";

const Navigation = () => {
  const [navigationActive, setNavigationActive] = useState(false);
  const { user, userLoading } = useContext(UserContext);

  const toggleNavigationMobile = () => setNavigationActive(!navigationActive);

  let accountButtons;
  if (navigationActive) {
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
            alt="Neighborly Logo"
            aria-label="Neighborly Logo"
            src={logo}
          />
        </Link>
        <button
          className={`navbar-burger ${navigationActive ? "is-active" : ""}`}
          aria-label="navigation menu dropdown"
          aria-expanded="false"
          data-target="navigation-menu"
          onClick={toggleNavigationMobile}
        >
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
      </div>
      <div
        id="navigation-menu"
        className={`navbar-menu ${navigationActive ? "is-active" : ""}`}
      >
        <div className="navbar-end">
          <Link to="/" className="navbar-item">
            Home
          </Link>
          <Link to="/feed" className="navbar-item">
            Feed
          </Link>
          {accountButtons}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
