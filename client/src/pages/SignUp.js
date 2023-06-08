const SignUp = () => {
  const registerUser = () => {};

  return (
    <section class="container has-background-green">
      <div class="hero is-fullheight-with-navbar">
        <div class="hero-body container has-text-centered">
          <div class="register columns">
            <div class="column is-half left">
              <h1 class="title is-1">Welcome to the block party</h1>
              <h2 class="subtitle colored is-4">We're glad you're here.</h2>
              <p class="has-text-grey-darker">
                By joining Neighborly, you become part of a collaborative
                community, promoting sustainability, reducing waste, and
                fostering a stronger sense of belonging.
              </p>
            </div>
            <div class="column is-half right">
              <h1 class="title is-3">Sign up for free</h1>
              <form>
                <div class="field">
                  <div class="control">
                    <input
                      class="input is-medium"
                      type="text"
                      placeholder="Name"
                    />
                  </div>
                </div>

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
                  <div class="control">
                    <input
                      class="input is-medium"
                      type="password"
                      placeholder="Confirm Password"
                    />
                  </div>
                </div>
                <button
                  onClick={registerUser}
                  class="button is-block is-info is-fullwidth is-medium"
                >
                  Create Account <i class="fa fa-sign-in"></i>
                </button>
                <br />
                <small class="has-text-grey-darker">
                  Already have an account?{" "}
                  <a class="link has-text-bold" href="/login">
                    Login here.
                  </a>
                </small>
              </form>
            </div>
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

export default SignUp;
