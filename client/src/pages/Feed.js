import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NeighborhoodSelect from "../components/NeighborhoodSelect";

const Feed = () => {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // fetchPosts();
  }, []);

  return (
    <div className="feed">
      <div className="columns">
        <div className="column is-3">
          <div className="box sidebar">
            <NeighborhoodSelect />
            <Link to="/feed/lending">
              <p>Lending</p>
            </Link>
            <Link to="/feed/borrowing">
              <p>Borrowing</p>
            </Link>
            <Link to="/feed/trading">Trading</Link>
          </div>
        </div>
        <div className="column">
          {posts.map((post) => (
            <div className="box" key={post.id}>
              <article className="media">
                <div className="media-left">
                  <figure className="image is-64x64">
                    <img src={post.image} alt="Post" />
                  </figure>
                </div>
                <div className="media-content">
                  <div className="content">
                    <p>
                      <strong>{post.author}</strong>
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
  );
};

export default Feed;
