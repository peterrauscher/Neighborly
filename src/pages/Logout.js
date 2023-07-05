import { useContext, useEffect } from "react";
import { useNavigate } from "react-router";
import { UserContext } from "../contexts/UserContext";

const Logout = () => {
  const navigate = useNavigate();
  const { user, logOutUser } = useContext(UserContext);

  useEffect(() => {
    if (user) {
      logOutUser();
      navigate("/");
    }
  }, [user, logOutUser, navigate]);

  return (
    <section className="container">
      <div className="hero is-fullheight-with-navbar">
        <div className="hero-body container has-text-centered">
          <h1 className="title is-1">Later Neighbor!</h1>
        </div>
      </div>
    </section>
  );
};

export default Logout;
