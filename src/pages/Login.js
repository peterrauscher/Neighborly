import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { UserContext } from "../contexts/UserContext";

const EmptyForm = {
  email: "",
  password: "",
};

const Login = () => {
  const [formData, setFormData] = useState(EmptyForm);
  const [errorMsg, setErrorMsg] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loginAsDemo, emailPasswordLogin } = useContext(UserContext);

  const handleRedirect = useCallback(() => {
    const goTo = location.search.replace("?redirect=", "");
    navigate(goTo ? goTo : "/feed");
  }, [location.search, navigate]);

  const loginUser = async () => {
    if (formData.email && formData.password) {
      setErrorMsg("");
      const res = await emailPasswordLogin(formData.email, formData.password);
      if (res?.success) {
        setFormData(EmptyForm);
        handleRedirect();
      } else {
        setErrorMsg(res?.error || "Login failed");
      }
    }
  };

  const handleDemo = (e) => {
    e.preventDefault();
    loginAsDemo("user_peter");
    handleRedirect();
  };
  const handleState = (e) =>
    setFormData((data) => ({ ...data, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    loginUser();
  };

  const resetPassword = () => {};

  useEffect(() => {
    if (user) {
      handleRedirect();
    }
  }, [user, handleRedirect]);

  return (
    <div className="has-background-green">
      <section className="container">
        <div className="hero is-fullheight-with-navbar">
          <div className="hero-body container has-text-centered">
            <div className="login columns">
              <div className="column">
                <h1 className="title is-3">Welcome back</h1>
                <div className="notification is-light is-info has-text-center p-3 mb-4">
                  <p className="is-size-7 mb-2">
                    <strong>Quick Demo Access</strong>
                  </p>
                  <button
                    type="button"
                    className="button is-dark is-small is-fullwidth"
                    onClick={handleDemo}
                  >
                    Explore as Peter (Demo)
                  </button>
                </div>
                {errorMsg && (
                  <div className="notification is-danger is-light p-2 mb-3 is-size-7">
                    {errorMsg}
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                  <div className="field">
                    <div className="control">
                      <input
                        className="input is-medium"
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleState}
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
                        value={formData.password}
                        onChange={handleState}
                      />
                    </div>
                  </div>

                  {/* <div className="field">
                    <label className="checkbox">
                      <input type="checkbox" /> Remember me
                    </label>
                  </div> */}

                  <button className="button is-block is-orange is-fullwidth is-medium">
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
    </div>
  );
};

export default Login;
