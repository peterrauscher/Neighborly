import ReactTimeAgo from "react-time-ago";

const Post = ({ post }) => {
  return (
    <div className="card post" key={post._id}>
      <div className="card-heading">
        <div className="post-author">
          <img
            className="avatar"
            src="https://via.placeholder.com/96"
            alt="User's avatar"
          />
          <div className="author-info">
            <a href={`/user/${post.authorId}`}>John Doe</a>
            <p className="post-time">
              <ReactTimeAgo date={post.postedAt} locale="en-US" />
            </p>
          </div>
        </div>
      </div>
      <div className="card-content">
        <div className="content">{post.content}</div>
      </div>
      <div className="card-image">
        {post.images && (
          <figure className="image is-64x64">
            <img src={post.images[0]} alt="Post" />
          </figure>
        )}
      </div>
    </div>
  );
};

export default Post;
