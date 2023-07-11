import { useLazyQuery } from "@apollo/client";
import Loading from "components/Loading";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Compose from "../components/Compose";
import { NEIGHBORS, POSTS } from "../realm/graphql";
import DefaultErrorPage from "./DefaultErrorPage";
import LocationSelect from "../components/LocationSelect";
import { UserContext } from "contexts/UserContext";
import Post from "components/Post";
import ReactTimeAgo from "react-time-ago";

const Feed = ({ posts = "all" }) => {
  const { user, setUserNeighborhood } = useContext(UserContext);
  const [neighborhood, setNeighborhood] = useState(
    user.customData.neighborhood ? user.customData.neighborhood : null
  );
  const [shouldReload, setShouldReload] = useState(true);
  const [
    getAllPosts,
    { loading: loadingPosts, error: errorPosts, data: dataPosts },
  ] = useLazyQuery(POSTS, {
    fetchPolicy: "network-only",
  });
  const [
    getAllNeighbors,
    { loading: loadingNeighbors, error: errorNeighbors, data: dataNeighbors },
  ] = useLazyQuery(NEIGHBORS, {
    fetchPolicy: "cache-first",
  });

  const postLink = (type, href, text) => {
    return { isActive: type === posts, type: type, href: href, text: text };
  };

  const postLinks = [
    postLink("all", "/feed", "All Posts"),
    postLink("lend", "/feed/lend", "Lend"),
    postLink("borrow", "/feed/borrow", "Borrow"),
    postLink("trade", "/feed/trade", "Trade"),
  ];

  // const postFilter = (type, text) => {};
  // const postFilters = [postFilter()];

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
          placeId: neighborhood.placeId,
          postType: posts,
        },
      });
      setShouldReload(false);
    }
  }, [neighborhood, shouldReload, getAllPosts, posts]);

  useEffect(() => {
    if (neighborhood)
      getAllNeighbors({ variables: { placeId: neighborhood.placeId } });
  }, [neighborhood, getAllNeighbors]);

  if (errorPosts || errorNeighbors) return <DefaultErrorPage />;

  return (
    <div className="container">
      <div className="feed">
        <div className="columns">
          <div className="column is-3 sidebar-left">
            <div className="box sidebar">
              <div className="maps-selector">
                <p className="menu-label">
                  <span className="icon is-small">
                    <i className="fas fa-location-dot"></i>
                  </span>
                  <span> Neighborhood</span>
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
                  </span>
                  <span> Posts</span>
                </p>
                <ul className="menu-list">
                  {postLinks &&
                    postLinks.map((link) => {
                      return (
                        <li key={link.type}>
                          <Link
                            className={link.isActive ? "is-active" : ""}
                            to={link.href}
                          >
                            <p>{link.text}</p>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
                <p className="menu-label">
                  <span className="icon is-small">
                    <i className="fas fa-filter"></i>
                  </span>
                  <span> Filters</span>
                </p>
              </aside>
            </div>
          </div>
          <div className="column is-6 scrollable">
            <Compose setShouldReload={setShouldReload} />
            <div className="post-feed">
              {loadingPosts ? (
                <Loading />
              ) : (
                dataPosts?.postsWithAuthors &&
                dataPosts?.postsWithAuthors.map((post) => {
                  return <Post post={post} />;
                })
              )}
            </div>
          </div>
          <div className="column is-3 sidebar-right">
            <div className="box sidebar">
              <p className="menu-label">
                <span className="icon is-small">
                  <i className="fas fa-user-group"></i>
                </span>
                <span> Neighbors</span>
              </p>
              {loadingNeighbors ? (
                <Loading />
              ) : (
                dataNeighbors?.users &&
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
                        <a href={`/user/${user.accountId}`}>{user.name}</a>
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feed;
