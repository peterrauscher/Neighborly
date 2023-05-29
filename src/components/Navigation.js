import logo from "../images/logo-text.svg";

const Navigation = () => {
  return (
    <nav class="navbar" role="navigation" aria-label="navigation menu">
      <div class="container">
        <div class="navbar-brand">
          <a className="navbar-item" href="/">
            <img
              alt="Neighborly Logo"
              aria-label="Neighborly Logo"
              src={logo}
            />
          </a>
          <span
            class="navbar-burger"
            aria-label="navigation menu for mobile devices"
            aria-expanded="false"
            data-target="topNavigation"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </span>
        </div>
        <div id="topNavigation" class="navbar-menu">
          <div class="navbar-start"></div>
          <div class="navbar-end">
            <div class="tabs is-right">
              <a className="navbar-item" href="/">
                Home
              </a>
              <a className="navbar-item" href="/about">
                About
              </a>
              {/* Only show this if the user is logged in */}
              <a className="navbar-item" href="/feed">
                Feed
              </a>
              <div class="navbar-item">
                <div class="buttons">
                  <a href="/register" class="button is-primary">
                    <strong>Sign up</strong>
                  </a>
                  <a href="/login" class="button is-light">
                    Log in
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
