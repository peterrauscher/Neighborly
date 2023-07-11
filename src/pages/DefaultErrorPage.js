import Navigation from "../components/Navigation";

const DefaultErrorPage = () => {
  return (
    <>
      <Navigation></Navigation>
      <section className="hero is-fullheight-with-navbar is-bold">
        <div className="hero-body has-text-centered">
          <div className="container">
            <div className="columns">
              <div className="column">
                <figure className="image mx-auto my-6">
                  <img
                    className="error-img mx-auto"
                    src="https://storage.cloud.google.com/beneighborly.xyz/assets/error.png"
                    alt="error"
                  />
                </figure>
                <h1 className="title is-size-1">Uh oh!</h1>
                <h2 className="subtitle is-size-4">
                  Something went wrong, please try again later. Sorry about
                  that.
                </h2>
                <p className="content">
                  If you'd like, you can report this bug by taking a screenshot
                  and sending it along with a description of what caused the
                  error to my email,{" "}
                  <a className="link" href="mailto:peter@peterrauscher.com">
                    peter@peterrauscher.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default DefaultErrorPage;
