import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { UserContext } from "../contexts/UserContext";

const EmptyForm = {
  email: "",
  password: "",
};

const Login = () => {
  const [formData, setFormData] = useState(EmptyForm);
  const location = useLocation();
  const navigate = useNavigate();
  const { app, refreshUser, emailPasswordLogin } = useContext(UserContext);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const formRef = useRef(null);

  const loginUser = async () => {
    if (formData.email && formData.password) {
      await emailPasswordLogin(formData.email, formData.password);
      setFormData(EmptyForm);
      if (formRef && formRef.current) formRef.current.reset();
      handleRedirect();
    }
  };

  const handleState = (e) => {
    setFormData((data) => ({ ...data, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    loginUser();
  };

  const handleRedirect = useCallback(() => {
    const goTo = location.search.replace("?redirect=", "");
    navigate(goTo ? goTo : "/");
  }, [location.search, navigate]);

  const resetPassword = () => {};

  useEffect(() => {
    const loadUser = async () => {
      if (app.currentUser) handleRedirect();
      else {
        const fetchedUser = await refreshUser();
        if (fetchedUser) handleRedirect();
      }
    };
    loadUser();
  }, [app.currentUser, refreshUser, handleRedirect]);

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
