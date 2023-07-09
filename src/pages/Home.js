import { Link } from "react-router-dom";

const Home = () => {
  return (
    <>
      <section className="hero is-fullheight-with-navbar home-hero">
        <div className="hero-body">
          <div className="container">
            <div className="columns is-vcentered is-narrow">
              <div className="column content is-two-fifths">
                <p className="title is-1 has-text-white-ter">
                  Welcome To The Neighborhood
                </p>
                <p className="subtitle is-4 has-text-white-ter">
                  Unleash the power of sharing and strengthen your community
                  with Neighborly. Connect with neighbors to borrow, lend, and
                  trade responsibly.
                </p>
                <div className="buttons">
                  <a href="#learn-more" className="button is-white is-rounded">
                    Learn More
                  </a>
                  <Link
                    to="/register"
                    className="button is-white is-outlined is-rounded"
                  >
                    Get started
                  </Link>
                </div>
              </div>
              <div className="column">
                <figure className="image container hero-fig">
                  <img
                    className="hero-img has-image-centered"
                    alt="Colorful row of houses"
                    src="https://storage.cloud.google.com/beneighborly.xyz/assets/neighborhood.png"
                  ></img>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        id="learn-more"
        className="hero has-background-default pt-6 pb-3"
      >
        <div className="container has-text-centered">
          <p className="title is-2">Why us?</p>
          <p className="subtitle is-5">
            There's more than a few reasons to connect with your community on
            Neighborly
          </p>
        </div>
      </section>
      <section className="hero benefits">
        <div className="hero-body">
          <div className="container">
            <div className="columns is-flex is-vcentered is-narrow">
              <div className="column content blurb">
                <p className="title is-3">Foster Community</p>
                <p className="subtitle is-5">
                  Connect with neighbors, have meaningful interactions, and
                  build trust through responsible borrowing, lending, and
                  trading.
                </p>
              </div>
              <div className="column">
                <figure className="image">
                  <img
                    className="has-image-centered"
                    src="https://storage.cloud.google.com/beneighborly.xyz/assets/foster-community.png"
                    alt="People walking together"
                  ></img>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="hero benefits has-background-white">
        <div className="hero-body">
          <div className="container">
            <div className="columns is-flex is-vcentered is-narrow">
              <div className="column">
                <figure className="image">
                  <img
                    className="has-image-centered"
                    src="https://storage.cloud.google.com/beneighborly.xyz/assets/live-sustainably.png"
                    alt="Man and woman recycling"
                  ></img>
                </figure>
              </div>
              <div className="column content blurb">
                <p className="title is-3">Live Sustainably</p>
                <p className="subtitle is-5">
                  Help save the planet by reducing your individual consumption
                  and minimizing waste through the use of shared resources.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="hero benefits">
        <div className="hero-body">
          <div className="container">
            <div className="columns is-flex is-vcentered is-narrow">
              <div className="column content blurb">
                <p className="title is-3">Save Money</p>
                <p className="subtitle is-5">
                  Keep more money in your pocket by skipping on big purchases
                  for things you'll only use once. Be honest, when's the last
                  time you used your leafblower?
                </p>
              </div>
              <div className="column">
                <figure className="image">
                  <img
                    className="has-image-centered"
                    src="https://storage.cloud.google.com/beneighborly.xyz/assets/save-money.png"
                    alt="Piggy bank"
                  ></img>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="hero benefits has-background-white pb-6">
        <div className="hero-body">
          <div className="container">
            <div className="columns is-flex is-vcentered is-narrow">
              <div className="column">
                <figure className="image ">
                  <img
                    className="has-image-centered"
                    src="https://storage.cloud.google.com/beneighborly.xyz/assets/find-space.png"
                    alt="Man and woman recycling"
                  ></img>
                </figure>
              </div>
              <div className="column content blurb">
                <p className="title is-3">Find Space</p>
                <p className="subtitle is-5">
                  Make the most of your square footage. Beyond homegoods, you
                  can find or list unused space within your community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="hero p-6 call-to-action">
        <div className="container has-text-centered">
          <p className="title is-2 is-spaced">Ready to get started?</p>
          <p className="subtitle is-5">
            There's absolutely nothing to lose. So what are you waiting for?
          </p>
          <Link
            to="/register"
            className="button is-dark is-rounded has-text-bold"
          >
            Sign up for free
          </Link>
        </div>
      </section>
      <footer className="footer">
        <div className="container">
          <div className="columns">
            <div className="column is-one-third">
              <p>© {new Date().getFullYear()} Neighborly.</p>
              <br />
              <p>
                For site inquiries, contact{" "}
                <a className="link" href="mailto:support@beneighborly.xyz">
                  support@beneighborly.xyz
                </a>
              </p>
            </div>
            <div className="column is-one-quarter">
              <p className="label">Site</p>
              <Link className="link" to="/feed">
                <p>All Posts</p>
              </Link>
              <Link className="link" to="/feed/borrow">
                <p>Borrow</p>
              </Link>
              <Link className="link" to="/feed/lend">
                <p>Lend</p>
              </Link>
              <Link className="link" to="/feed/trade">
                <p>Trade</p>
              </Link>
            </div>
            <div className="column is-one-quarter">
              <p className="label">Social</p>
              <Link className="link" to="https://peterrauscher.com">
                <p>Blog</p>
              </Link>
              <Link
                className="link"
                to="https://github.com/peterrauscher/Neighborly"
              >
                <p>Github</p>
              </Link>
              <Link
                className="link"
                to="https://devpost.com/software/neighborly-42ghs1"
              >
                <p>Devpost</p>
              </Link>
              <Link
                className="link"
                to="https://www.linkedin.com/in/peter-rauscher"
              >
                <p>Linkedin</p>
              </Link>
            </div>
            <div className="column is-one-quarter">
              <p className="label">Help</p>
              <Link className="link" to="/help">
                <p>Support</p>
              </Link>
              <Link className="link" to="/contact">
                <p>Contact Us</p>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Home;
