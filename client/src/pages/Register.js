import { useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";

const Register = () => {
  const { user, emailPasswordSignup } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const nameRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();
  const confirmPasswordRef = useRef();
  const formRef = useRef();

  const registerUser = async () => {
    console.log(formData);
    await emailPasswordSignup(
      formData.name,
      formData.email,
      formData.password,
      formData.confirmPassword
    );
    setFormData({});
    formRef.current.reset();
    handleRedirect();
  };

  const handleState = (e) => {
    setFormData((data) => ({ ...data, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    registerUser();
  };

  const handleRedirect = () => {
    const goTo = location.search.replace("?redirect=", "");
    navigate(goTo ? goTo : "/");
  };

  useEffect(() => {
    nameRef.current.addEventListener("input", handleState);
    emailRef.current.addEventListener("input", handleState);
    passwordRef.current.addEventListener("input", handleState);
    confirmPasswordRef.current.addEventListener("input", handleState);
  }, []);

  return (
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
              <form ref={formRef} onSubmit={handleSubmit}>
                <div className="field">
                  <div className="control">
                    <input
                      className="input is-medium"
                      type="text"
                      placeholder="Name"
                      name="name"
                      ref={nameRef}
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
                      ref={emailRef}
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
                      ref={passwordRef}
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
                      ref={confirmPasswordRef}
                    />
                  </div>
                </div>
                <button className="button is-block is-info is-fullwidth is-medium">
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
  );
};

export default Register;
