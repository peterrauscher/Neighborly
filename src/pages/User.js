import { useQuery } from "@apollo/client";
import Loading from "components/Loading";
import ProfilePost from "components/ProfilePost";
import UnsplashImage from "components/UnsplashImage";
import { useNavigate, useParams } from "react-router-dom";
import { USER, USER_POSTS } from "realm/graphql";

const User = () => {
  const accountId = useParams()["*"];
  const { data, error, loading } = useQuery(USER, {
    variables: { accountId: accountId },
  });
  const {
    data: postData,
    error: postError,
    loading: postLoading,
  } = useQuery(USER_POSTS, {
    variables: { accountId: accountId },
  });
  const navigate = useNavigate();

  if (error || postError) navigate("/not-found");
  if (loading || postLoading) return <Loading />;

  return (
    <>
      <section className="section user-profile">
        <div className="container">
          <div className="user-cover">
            <UnsplashImage searchTerm="Neighborhood" />
          </div>
          <div className="user-info">
            <div className="top">
              <div className="user-avatar">
                <img src={data.user.avatar} />
              </div>
            </div>
            <div className="bottom">
              <div className="name-and-follow">
                <p className="title is-3">{data.user.name}</p>
              </div>
              <div className="stats">
                <p className="content">
                  <span>
                    <span className="icon">
                      <i className="fa fa-map-pin"></i>
                    </span>{" "}
                    {data.user.neighborhood.label}
                  </span>
                </p>
                <p className="content">
                  <span>
                    <span className="icon">
                      <i className="fa fa-pen-nib"></i>
                    </span>
                    123 Posts
                  </span>
                  <span>
                    <span className="icon">
                      <i className="fa fa-user-group"></i>
                    </span>{" "}
                    11 Friends
                  </span>
                </p>
              </div>
              <div className="bio pt-2">
                <p className="content">
                  {data.user.bio ? data.user.bio : "No bio"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="section user-posts">
        <div className="container">
          <div className="post-feed">
            {postData && postData.posts.length > 0 ? (
              postData.posts.map((post) => {
                return <ProfilePost post={post} author={data.user} />;
              })
            ) : (
              <div className="has-text-centered">
                <p>No posts yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default User;
