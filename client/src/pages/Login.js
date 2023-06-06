const resetPassword = () => {};

const Login = () => {
  return (
    <section class="container">
      <div class="columns is-multiline">
        <div class="column is-8 is-offset-2 register">
          <div class="columns is-flex is-vcentered">
            <div class="column left">
              <h1 class="title is-1">Welcome back</h1>
              <h2 class="subtitle colored is-4">
                I guess this town <em>is</em> big enough for the both of us.
              </h2>
              <p class="has-text-grey-dark">
                Hop right back in, the block parties haven't been the same
                without you!
              </p>
            </div>
            <div class="column right has-text-centered">
              <h1 class="title is-3">Log in</h1>
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
                <button class="button is-block is-info is-fullwidth is-medium">
                  Submit
                </button>
                <hr />
                <small class="is-block">
                  <button
                    type="button"
                    id="password-reset"
                    class="link is-bold"
                    onClick={resetPassword}
                  >
                    Forgot password?
                  </button>
                </small>
                <br />
                <small class="is-block has-text-grey-dark">
                  New to the neighborhood?{" "}
                  <a class="link is-bold" href="/register">
                    Create an account.
                  </a>
                </small>
              </form>
            </div>
          </div>
        </div>
        <div class="column is-8 is-offset-2">
          <br />
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
    </section>
  );
};

export default Login;
