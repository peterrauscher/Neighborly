import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";

const EmptyForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const Register = () => {
  const { app, refreshUser, emailPasswordSignup } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(EmptyForm);

  const registerUser = async () => {
    console.log(formData);
    await emailPasswordSignup(
      formData.name,
      formData.email,
      formData.password,
      formData.confirmPassword
    );
    setFormData(EmptyForm);
    handleRedirect();
  };

  const handleState = (e) =>
    setFormData((data) => ({ ...data, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    registerUser();
  };

  const handleRedirect = useCallback(() => {
    const goTo = location.search.replace("?redirect=", "");
    navigate(goTo ? goTo : "/");
  }, [location.search, navigate]);

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

  return (
    <div className="has-background-green">
      <section className="container">
        <div className="hero is-fullheight-with-navbar">
          <div className="hero-body container has-text-centered">
            <div className="register columns">
              <div className="column is-half is-hidden-mobile left">
                <h1 className="title is-1">Welcome to the block party</h1>
                <p>
                  By joining Neighborly, you become part of a collaborative
                  community, promoting sustainability, reducing waste, and
                  fostering a stronger sense of belonging.
                </p>
              </div>
              <div className="column is-half right">
                <h1 className="title is-3">Sign up for free</h1>
                <form onSubmit={handleSubmit}>
                  <div className="field">
                    <div className="control">
                      <input
                        className="input is-medium"
                        type="text"
                        placeholder="Name"
                        name="name"
                        value={formData.name}
                        onChange={handleState}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <div className="control">
                      <input
                        className="input is-medium"
                        type="email"
                        placeholder="Email"
                        name="email"
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
                        placeholder="Password"
                        name="password"
                        value={formData.password}
                        onChange={handleState}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <div className="control">
                      <input
                        className="input is-medium"
                        type="password"
                        placeholder="Confirm Password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleState}
                      />
                    </div>
                  </div>
                  <button className="button is-block is-orange is-fullwidth is-medium">
                    Create Account <i className="fa fa-sign-in"></i>
                  </button>
                  <br />
                  <small className="has-text-grey-darker">
                    Already have an account?{" "}
                    <a className="link has-text-bold" href="/login">
                      Login here.
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

export default Register;
