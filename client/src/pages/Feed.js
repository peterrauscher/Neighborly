import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NeighborhoodSelect from "../components/NeighborhoodSelect";
import { UserContext } from "../contexts/UserContext";
import axios from "axios";

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const { user } = useContext(UserContext);

  useEffect(() => {
    const fetchPosts = async () => {
      const fetchedPosts = await axios.get(
        "https://jsonplaceholder.typicode.com/posts"
      );
      setPosts(fetchedPosts.data);
    };
    fetchPosts();
  }, []);

  return (
    <div className="feed">
      <div className="columns">
        <div className="column is-3">
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
            <p class="heading">FILTERS</p>
          </div>
        </div>
        <div className="column">
          <div className="box post-feed">
            {posts &&
              posts.map((post) => (
                <div className="box" key={post.id}>
                  <article className="media">
                    <div className="media-left">
                      <figure className="image is-64x64">
                        {/* <img src={post.image} alt="Post" /> */}
                      </figure>
                    </div>
                    <div className="media-content">
                      <div className="content">
                        <p>
                          <strong>{post.title}</strong>
                          <br />
                          {post.body}
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
