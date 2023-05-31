import logo from "../images/logo-text.svg";

const Navigation = () => {
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
            class="navbar-burger burger"
            aria-label="navigation menu dropdown"
            aria-expanded="false"
            data-target="topNavigation"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>
        <div id="topNavigation" class="navbar-menu">
          <div class="navbar-start"></div>
          <div class="navbar-end">
            <div class="tabs is-right">
              <a className="navbar-item" href="/">
                Home
              </a>
              {/* Only show this if the user is logged in */}
              <a className="navbar-item" href="/feed">
                Feed
              </a>
              <div class="navbar-item">
                <div class="buttons">
                  <a href="/register" class="button is-rounded is-info">
                    Sign up
                  </a>
                  <a
                    href="/login"
                    class="button is-rounded is-success is-outlined"
                  >
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
