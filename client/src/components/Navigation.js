import { useState } from "react";
import logo from "../images/logo-text.svg";

const Navigation = () => {
  const [navigationActive, setNavigationActive] = useState(false);

  const toggleNavigationMobile = () => setNavigationActive(!navigationActive);

  const accountButtons = navigationActive ? (
    <>
      <a href="/register" className="navbar-item" display>
        Sign up
      </a>
      <a href="/login" className="navbar-item">
        Log in
      </a>
    </>
  ) : (
    <>
      <div className="navbar-item pr-2">
        <a href="/register" className="button is-info" display>
          Sign up
        </a>
      </div>
      <div className="navbar-item pl-2">
        <a
          href="/login"
          className="button is-primary is-outlined has-text-bold"
        >
          Log in
        </a>
      </div>
    </>
  );

  return (
    <nav
      class="navbar is-fixed-top"
      role="navigation"
      aria-label="navigation menu"
    >
      <div class="container">
        <div class="navbar-brand">
          <a className="navbar-item" href="/">
            <img
              alt="Neighborly Logo"
              aria-label="Neighborly Logo"
              src={logo}
            />
          </a>
          <button
            class={`navbar-burger ${navigationActive ? "is-active" : ""}`}
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
          class={`navbar-menu ${
            navigationActive ? "is-active has-text-right" : ""
          }`}
        >
          <div class="navbar-end">
            <a className="navbar-item" href="/">
              Home
            </a>
            <a className="navbar-item" href="/feed">
              Feed
            </a>
            {accountButtons}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
