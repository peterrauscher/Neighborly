import ReactTimeAgo from "react-time-ago";

const Post = ({ post }) => {
  return (
    <div className="card post">
      <div className="card-heading">
        <div className="post-author">
          <img
            className="avatar"
            src={post.author.avatar}
            alt={`${post.author.name}'s avatar`}
          />
          <div className="author-info">
            <a href={`/user/${post.author.accountId}`}>{post.author.name}</a>
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
            <img alt={`Uploaded by ${post.author.name}`} src={post.images[0]} />
          </figure>
        )}
      </div>
    </div>
  );
};

export default Post;
