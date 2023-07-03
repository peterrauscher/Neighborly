import { useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { UserContext } from "../contexts/user.context";

const Login = () => {
  const [formData, setFormData] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, fetchUser, emailPasswordLogin } = useContext(UserContext);
  const emailRef = useRef();
  const passwordRef = useRef();
  const formRef = useRef();

  const loginUser = async () => {
    await emailPasswordLogin(formData.email, formData.password);
    setFormData({});
    formRef.current.reset();
    handleRedirect();
  };

  const handleState = (e) => {
    setFormData((data) => ({ ...data, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    loginUser();
  };

  const handleRedirect = () => {
    const goTo = location.search.replace("?redirect=", "");
    navigate(goTo ? goTo : "/");
  };

  const resetPassword = () => {};

  useEffect(() => {
    const loadUser = async () => {
      if (!user) {
        const fetchedUser = await fetchUser();
        if (fetchedUser) handleRedirect();
      }
    };
    loadUser();
  }, [user]);

  useEffect(() => {
    emailRef.current.addEventListener("input", handleState);
    passwordRef.current.addEventListener("input", handleState);
  });

  return (
    <section className="container">
      <div className="hero is-fullheight-with-navbar">
        <div className="hero-body container has-text-centered">
          <div className="login columns">
            <div className="column">
              <h1 className="title is-3">Welcome back</h1>
              <form ref={formRef} onSubmit={handleSubmit}>
                <div className="field">
                  <div className="control">
                    <input
                      className="input is-medium"
                      type="email"
                      name="email"
                      placeholder="Email"
                      ref={emailRef}
                    />
                  </div>
                </div>

                <div className="field">
                  <div className="control">
                    <input
                      className="input is-medium"
                      type="password"
                      name="password"
                      placeholder="Password"
                      ref={passwordRef}
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="checkbox">
                    <input type="checkbox" /> Remember me
                  </label>
                </div>

                <button className="button is-block is-info is-fullwidth is-medium">
                  Login <i className="fa fa-sign-in"></i>
                </button>
                <hr />
                <small className="is-block">
                  <button
                    type="button"
                    id="password-reset"
                    className="link has-text-bold"
                    onClick={resetPassword}
                  >
                    Forgot password?
                  </button>
                </small>
                <br />
                <small className="is-block has-text-grey-darker">
                  New to the neighborhood?{" "}
                  <a className="link has-text-bold" href="/register">
                    Create an account.
                  </a>
                </small>
              </form>
            </div>
          </div>
        </div>
        <div className="hero">
          <div className="hero-body has-text-centered container">
            <nav className="level">
              <div className="level-item">
                <a href="https://github.com/peterrauscher/Neighborly">
                  <span className="icon has-text-white">
                    <i className="fa-brands fa-github"></i>
                  </span>
                </a>{" "}
                &emsp;
                <a href="mailto:peterrauscher@protonmail.com">
                  <span className="icon has-text-white">
                    <i className="fa-solid fa-envelope"></i>
                  </span>
                </a>{" "}
                &emsp;
                <a href="https://atlasmadness.devpost.com">
                  <span className="icon has-text-white">
                    <i className="fa-solid fa-d"></i>
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
