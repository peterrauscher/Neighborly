import { useQuery } from "@apollo/client";
import Loading from "components/Loading";
import { useNavigate, useParams } from "react-router-dom";
import { USER } from "realm/graphql";

const User = () => {
  const accountId = useParams()["*"];
  const { data, error, loading } = useQuery(USER, {
    variables: { accountId: accountId },
  });
  const navigate = useNavigate();

  if (error) navigate("/not-found");
  if (loading) return <Loading />;

  return (
    <div className="container">
      <div className="columns">
        <div className="column is-3">
          <div className="avatar-box">
            <figure className="image is-128x128">
              <img className="is-rounded" src={data.user.avatar} />
            </figure>
          </div>
          <aside className="menu">
            <p className="menu-label">Profile</p>
            <ul className="menu-list">
              <li>
                <a className="is-active">My Profile</a>
              </li>
              <li>
                <a>Settings</a>
              </li>
            </ul>
          </aside>
        </div>
        <div className="column">
          <div className="container">
            <h1 className="title">My Profile</h1>
            <h2 className="subtitle">Welcome to your Neighborly profile!</h2>
          </div>
          <section className="section">
            <div className="content">
              <p>
                <strong>Name:</strong> {data.user.name}
              </p>
              <p>
                <strong>Email:</strong> johndoe@example.com
              </p>
              <p>
                <strong>Location:</strong> San Francisco, CA
              </p>
              <p>
                <strong>Bio:</strong> Lorem ipsum dolor sit amet, consectetur
                adipiscing elit. Aenean commodo, lorem eu viverra scelerisque,
                sem velit condimentum magna, eget lacinia neque nisl a ligula.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default User;
