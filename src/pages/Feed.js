import { useLazyQuery } from "@apollo/client";
import Loading from "components/Loading";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Compose from "../components/Compose";
import { POSTS } from "../realm/graphql";
import DefaultErrorPage from "./DefaultErrorPage";
import ReactTimeAgo from "react-time-ago";
import LocationSelect from "../components/LocationSelect";
import { UserContext } from "contexts/UserContext";

const Feed = () => {
  const { user, setUserNeighborhood } = useContext(UserContext);
  const [neighborhood, setNeighborhood] = useState(
    user.customData.neighborhood ? user.customData.neighborhood : null
  );
  const [getAllPosts, { loading, error, data }] = useLazyQuery(POSTS, {
    fetchPolicy: "network-only",
  });

  const handleNeighborhoodChange = (n) => {
    setNeighborhood({
      label: n.label,
      placeId: n.value.place_id,
    });
    setUserNeighborhood({
      label: n.label,
      placeId: n.value.place_id,
    });
  };

  useEffect(() => {
    if (neighborhood) {
      getAllPosts({
        variables: {
          filter: {
            neighborhood: {
              placeId: neighborhood.place_id,
            },
          },
        },
      });
    } else getAllPosts();
  }, [neighborhood]);

  if (error) return <DefaultErrorPage />;

  return (
    <div className="feed">
      <div className="columns">
        <div className="column sidebar-root is-3">
          <div className="box sidebar">
            <div className="maps-selector">
              <p className="heading">
                <span className="icon is-small">
                  <i className="fas fa-location-dot"></i>
                </span>{" "}
                Neighborhood
              </p>
              <LocationSelect
                neighborhood={neighborhood}
                setNeighborhood={handleNeighborhoodChange}
              />
            </div>
          </div>
          <div className="box sidebar">
            <aside className="menu">
              <p className="menu-label">I'm looking for...</p>
              <ul className="menu-list">
                <li>
                  <Link className="is-active" to="/feed">
                    <p>All Posts</p>
                  </Link>
                </li>
                <li>
                  <Link to="/feed/lend">
                    <p>Lend</p>
                  </Link>
                </li>
                <li>
                  <Link to="/feed/borrow">
                    <p>Borrow</p>
                  </Link>
                </li>
                <li>
                  <Link to="/feed/trade">
                    <p>Trade</p>
                  </Link>
                </li>
              </ul>
              <p className="menu-label">FILTERS</p>
            </aside>
          </div>
        </div>
        <div className="column scrollable">
          <Compose />
          <div className="post-feed">
            {loading ? (
              <Loading />
            ) : (
              data?.posts &&
              data.posts.map((post) => (
                <div className="card post" key={post.id}>
                  <div className="card-heading">
                    <div className="author-info">
                      <img
                        className="avatar"
                        src="https://via.placeholder.com/96"
                        alt="User's avatar"
                      />
                      <a href="/user/username">Dan Walker</a>
                      <span className="post-time">
                        <ReactTimeAgo date={post.postedAt} locale="en-US" />
                      </span>
                    </div>
                  </div>
                  <article className="media">
                    {post.images && (
                      <div className="media-left">
                        <figure className="image is-64x64">
                          <img src={post.images[0]} alt="Post" />
                        </figure>
                      </div>
                    )}
                    <div className="media-content">
                      <div className="content">
                        <p>
                          <strong>{post.authorId}</strong>
                          <br />
                          {post.content}
                        </p>
                      </div>
                    </div>
                  </article>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feed;
