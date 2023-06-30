import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../images/logo-text.svg";
import { UserContext } from "../contexts/user.context";

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
          <Link to="/register" className="button is-info">
            Sign up
          </Link>
        </div>
        <div className="navbar-item pl-2">
          <Link to="/login" className="button is-primary is-outlined">
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
        <Link to="/" className="navbar-item">
          <img alt="Neighborly Logo" aria-label="Neighborly Logo" src={logo} />
        </Link>
        <button
          className={`navbar-burger ${navigationActive ? "is-active" : ""}`}
          aria-label="navigation menu dropdown"
          aria-expanded="false"
          data-target="topNavigation"
          onClick={toggleNavigationMobile}
        >
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
      </div>
      <div
        id="topNavigation"
        className={`navbar-menu ${
          navigationActive ? "is-active has-text-right" : ""
        }`}
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
