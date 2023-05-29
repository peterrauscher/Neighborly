const SignUp = () => {
  return (
    <div classname="main">
      <form class="box">
        <div class="field">
          <label class="label">Email</label>
          <div class="control">
            <input
              class="input"
              type="email"
              placeholder="e.g. johndoe@example.com"
            />
          </div>
        </div>

        <div class="field">
          <label class="label">Password</label>
          <div class="control">
            <input class="input" type="password" placeholder="********" />
          </div>
        </div>

        <button class="button is-primary">Sign Up</button>
      </form>
    </div>
  );
};

export default SignUp;
