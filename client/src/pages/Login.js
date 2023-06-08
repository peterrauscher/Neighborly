const resetPassword = () => {};

const Login = () => {
  return (
    <section class="container has-background-green">
      <div class="hero is-fullheight-with-navbar">
        <div class="hero-body container has-text-centered">
          <div class="login">
            <h1 class="title is-3">Welcome Back</h1>
            <form>
              <div class="field">
                <div class="control">
                  <input
                    class="input is-medium"
                    type="email"
                    placeholder="Email"
                  />
                </div>
              </div>

              <div class="field">
                <div class="control">
                  <input
                    class="input is-medium"
                    type="password"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div class="field">
                <label class="checkbox">
                  <input type="checkbox" /> Remember me
                </label>
              </div>

              <button class="button is-block is-info is-fullwidth is-large">
                Login <i class="fa fa-sign-in"></i>
              </button>
              <hr />
              <small class="is-block">
                <button
                  type="button"
                  id="password-reset"
                  class="link has-text-bold"
                  onClick={resetPassword}
                >
                  Forgot password?
                </button>
              </small>
              <br />
              <small class="is-block has-text-grey-dark">
                New to the neighborhood?{" "}
                <a class="link has-text-bold" href="/register">
                  Create an account.
                </a>
              </small>
            </form>
          </div>
        </div>
        <div class="hero">
          <div class="hero-body has-text-centered container">
            <nav class="level">
              <div class="level-item">
                <a href="https://github.com/peterrauscher/Neighborly">
                  <span class="icon has-text-white">
                    <i class="fa-brands fa-github"></i>
                  </span>
                </a>{" "}
                &emsp;
                <a href="mailto:peterrauscher@protonmail.com">
                  <span class="icon has-text-white">
                    <i class="fa-solid fa-envelope"></i>
                  </span>
                </a>{" "}
                &emsp;
                <a href="https://atlasmadness.devpost.com">
                  <span class="icon has-text-white">
                    <i class="fa-solid fa-d"></i>
                  </span>
                </a>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
