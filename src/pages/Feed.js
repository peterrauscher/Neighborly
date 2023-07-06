import { useLazyQuery } from "@apollo/client";
import Loading from "components/Loading";
import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import Compose from "../components/Compose";
import NeighborhoodSelect from "../components/NeighborhoodSelect";
import { POSTS } from "../realm/graphql";
import DefaultErrorPage from "./DefaultErrorPage";
import ReactTimeAgo from "react-time-ago";

const Feed = () => {
  const [getAllPosts, { loading, error, data }] = useLazyQuery(POSTS, {
    fetchPolicy: "network-only",
  });

  const refreshFeed = useCallback(() => {
    getAllPosts();
  }, []);

  useEffect(() => {
    refreshFeed();
  }, []);

  if (loading) return <Loading />;
  if (error) return <DefaultErrorPage />;

  return (
    <div className="feed">
      <div className="columns">
        <div className="column sidebar-root is-3">
          <div className="box sidebar">
            <NeighborhoodSelect />
            <Link to="/feed">
              <p>All Posts</p>
            </Link>
            <Link to="/feed/lend">
              <p>Lend</p>
            </Link>
            <Link to="/feed/borrow">
              <p>Borrow</p>
            </Link>
            <Link to="/feed/trade">
              <p>Trade</p>
            </Link>
          </div>
          <div className="box sidebar">
            <p className="heading">FILTERS</p>
          </div>
        </div>
        <div className="column scrollable">
          <Compose refreshFeed={refreshFeed} />
          <div className="post-feed">
            {data?.posts &&
              data.posts.map((post) => (
                <div className="card post" key={post.id}>
                  <div className="card-heading">
                    <img
                      className="avatar"
                      src="https://via.placeholder.com/96"
                      alt="User's avatar"
                    />
                    <div className="author-info">
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
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feed;
