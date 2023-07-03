import { Link } from "react-router-dom";

const Home = () => {
  return (
    <>
      <section className="hero is-fullheight-with-navbar home-hero">
        <div className="hero-body">
          <div className="container">
            <div className="columns is-flex is-vcentered is-narrow">
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
                    src="/images/neighborhood.png"
                  ></img>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="hero has-background-default pt-6">
        <div className="container has-text-centered">
          <p className="title is-2">Why us?</p>
          <p className="subtitle is-5">
            There's more than a few reasons to connect with your community on
            Neighborly
          </p>
        </div>
      </section>
      <section id="learn-more" className="section benefits">
        <div className="container">
          <div className="columns is-centered">
            <div className="column is-half has-text-centered">
              <div className="box">
                <figure className="image my-4">
                  <img
                    className="max-quarter has-image-centered"
                    src="/images/foster-community.png"
                    alt="People walking together"
                  ></img>
                </figure>
                <p className="title is-3">Foster Community</p>
                <p className="subtitle is-5">
                  Connect with neighbors, have meaningful interactions, and
                  build trust through responsible borrowing, lending, and
                  trading.
                </p>
              </div>
            </div>
            <div className="column is-half has-text-centered">
              <div className="box">
                <figure className="image my-4">
                  <img
                    className="max-quarter has-image-centered"
                    src="/images/live-sustainably.png"
                    alt="Man and woman recycling"
                  ></img>
                </figure>
                <p className="title is-3">Live Sustainably</p>
                <p className="subtitle is-5">
                  Help save the planet by reducing your individual consumption
                  and minimizing waste through the use of shared resources.
                </p>
              </div>
            </div>
          </div>
          <div className="columns is-centered">
            <div className="column is-half has-text-centered">
              <div className="box">
                <figure className="image my-4">
                  <img
                    className="max-quarter has-image-centered"
                    src="/images/save-money.png"
                    alt="Piggy bank"
                  ></img>
                </figure>
                <p className="title is-3">Save Money</p>
                <p className="subtitle is-5">
                  Keep more money in your pocket by skipping on big purchases
                  for things you'll only use once. Be honest, when's the last
                  time you used your leafblower?
                </p>
              </div>
            </div>
            <div className="column is-half has-text-centered">
              <div className="box">
                <figure className="image my-4">
                  <img
                    className="max-quarter has-image-centered"
                    src="/images/find-space.png"
                    alt="Man and woman recycling"
                  ></img>
                </figure>
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
        <div className="container has-text-centered ">
          <p className="title is-2 is-spaced">Ready to get started?</p>
          <p className="subtitle is-5">
            There's absolutely nothing to lose. So what are you waiting for?
          </p>
          <Link
            to="/register"
            className="button is-dark is-outlined has-text-bold"
          >
            Sign up for free
          </Link>
        </div>
      </section>
      <footer className="footer pb-6">
        <div className="container has-text-centered">
          <aside className="menu">
            <p className="menu-label">About</p>
            <ul className="menu-list">
              <li>
                <Link to="https://github.com/peterrauscher/Neighborly">
                  Github
                </Link>
              </li>
              <li>
                <Link to="https://devpost.com/software/neighborly-42ghs1">
                  Devpost
                </Link>
              </li>
              <li>
                <Link to="https://www.linkedin.com/in/peter-rauscher">
                  Linkedin (I'm seeking a job)
                </Link>
              </li>
            </ul>
          </aside>
        </div>
      </footer>
    </>
  );
};

export default Home;
