const Feed = () => {
  let posts = [
    {
      image: "/images/mower.jpeg",
      id: "dhfoijsdfljkjlksdjfkl",
      author: "Peter R",
      content: "Hello, world! This is my lawn mower. Want it? Reach out to me!",
    },
  ];

  return (
    <div className="container">
      <div className="columns">
        <div className="column is-one-quarter">
          <div className="box sidebar">
            <h2 className="title is-5">Sidebar</h2>
            {/* Add additional sidebar content here */}
          </div>
        </div>
        <div className="column">
          <h1 className="title">Social Media Feed</h1>
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
