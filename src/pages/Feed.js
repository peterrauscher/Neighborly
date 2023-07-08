import { useLazyQuery, useQuery } from "@apollo/client";
import Loading from "components/Loading";
import { useCallback, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Compose from "../components/Compose";
import { NEIGHBORS, POSTS } from "../realm/graphql";
import DefaultErrorPage from "./DefaultErrorPage";
import LocationSelect from "../components/LocationSelect";
import { UserContext } from "contexts/UserContext";
import Post from "components/Post";
import ReactTimeAgo from "react-time-ago";

const Feed = () => {
  const { user, setUserNeighborhood } = useContext(UserContext);
  const [neighborhood, setNeighborhood] = useState(
    user.customData.neighborhood ? user.customData.neighborhood : null
  );
  const [shouldReload, setShouldReload] = useState(true);
  const [getAllPosts, { loading, error, data }] = useLazyQuery(POSTS, {
    fetchPolicy: "network-only",
  });
  const [
    getAllNeighbors,
    { loading: loadingNeighbors, error: errorNeighbors, data: dataNeighbors },
  ] = useLazyQuery(NEIGHBORS, {
    fetchPolicy: "cache-first",
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

  const refreshFeed = useCallback(() => {
    if (neighborhood && shouldReload) {
      getAllPosts({
        variables: {
          placeId: neighborhood.placeId,
        },
      });
    }
    setShouldReload(false);
  }, [neighborhood, shouldReload]);

  const refreshNeighbors = useCallback(() => {
    if (neighborhood)
      getAllNeighbors({ variables: { placeId: neighborhood.placeId } });
  }, [neighborhood]);

  useEffect(() => {
    refreshNeighbors();
    refreshFeed();
  }, [refreshFeed]);

  if (error || errorNeighbors) return <DefaultErrorPage />;

  return (
    <div className="container">
      <div className="feed">
        <div className="columns">
          <div className="column is-3 sidebar-left">
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
                <p className="menu-label">
                  <span className="icon is-small">
                    <i className="fas fa-rss"></i>
                  </span>{" "}
                  Posts
                </p>
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
                <p className="menu-label">
                  <span className="icon is-small">
                    <i className="fas fa-filter"></i>
                  </span>{" "}
                  Filters
                </p>
              </aside>
            </div>
          </div>
          <div className="column is-6 scrollable">
            <Compose setShouldReload={setShouldReload} />
            <div className="post-feed">
              {loading ? (
                <Loading />
              ) : (
                data?.posts &&
                data.posts.map((post) => {
                  return <Post post={post} />;
                })
              )}
            </div>
          </div>
          <div className="column is-3 sidebar-right">
            <div className="box sidebar">
              <p className="heading">
                <span className="icon is-small">
                  <i className="fas fa-user-group"></i>
                </span>{" "}
                Neighbors
              </p>
              {loadingNeighbors ? (
                <Loading />
              ) : dataNeighbors?.users && dataNeighbors?.users?.length > 0 ? (
                dataNeighbors?.users?.map((user) => {
                  return (
                    <div className="neighbor-block">
                      <img
                        className="avatar"
                        src={user.avatar}
                        alt={
                          user.name
                            ? `${user.name}'s avatar`
                            : "Neighbor's avatar"
                        }
                      />
                      <div>
                        <a href={`/users/${user.accountId}`}>{user.name}</a>
                        <p>
                          Last active{" "}
                          <ReactTimeAgo
                            date={user.lastActive}
                            locale="en-US"
                          ></ReactTimeAgo>
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p>No neighbors yet!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feed;
