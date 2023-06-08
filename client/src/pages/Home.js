const Home = () => {
  return (
    <>
      <section class="hero home-hero">
        <div class="hero-body">
          <div class="container">
            <div class="columns is-flex is-vcentered is-narrow">
              <div class="column content is-two-fifths">
                <p class="title is-1 has-text-white-ter">Hey, Neighbor!</p>
                <p class="subtitle is-4 has-text-white-ter">
                  Unleash the power of sharing and strengthen your community
                  with Neighborly - the platform connecting neighbors for
                  responsible borrowing, lending, and trading.
                </p>
              </div>
              <div class="column">
                <figure class="image container hero-fig">
                  <img
                    class="hero-img has-image-centered"
                    alt="Colorful row of houses"
                    src="/images/neighborhood.png"
                  ></img>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="hero pt-6 pb-0 has-background-default">
        <div class="container has-text-centered">
          <p class="title is-1">Why us?</p>
          <p class="subtitle is-3">
            There's more than a few reasons to connect with your community on
            Neighborly
          </p>
        </div>
      </section>
      <section class="section benefits">
        <div class="container">
          <div class="columns is-centered">
            <div class="column is-half has-text-centered">
              <div class="box">
                <figure class="image my-4">
                  <img
                    class="max-quarter has-image-centered"
                    src="/images/foster-community.png"
                    alt="People walking together"
                  ></img>
                </figure>
                <p class="title is-3">Foster Community</p>
                <p class="subtitle is-5">
                  Connect with neighbors, have meaningful interactions, and
                  build trust through responsible borrowing, lending, and
                  trading.
                </p>
              </div>
            </div>
            <div class="column is-half has-text-centered">
              <div class="box">
                <figure class="image my-4">
                  <img
                    class="max-quarter has-image-centered"
                    src="/images/live-sustainably.png"
                    alt="Man and woman recycling"
                  ></img>
                </figure>
                <p class="title is-3">Live Sustainably</p>
                <p class="subtitle is-5">
                  Help save the planet by reducing your individual consumption
                  and minimizing waste through the use of shared resources.
                </p>
              </div>
            </div>
          </div>
          <div class="columns is-centered">
            <div class="column is-half has-text-centered">
              <div class="box">
                <figure class="image my-4">
                  <img
                    class="max-quarter has-image-centered"
                    src="/images/save-money.png"
                    alt="Piggy bank"
                  ></img>
                </figure>
                <p class="title is-3">Save Money</p>
                <p class="subtitle is-5">
                  Keep more money in your pocket by skipping on big purchases
                  for things you'll only use once. Be honest, when's the last
                  time you used your leafblower?
                </p>
              </div>
            </div>
            <div class="column is-half has-text-centered">
              <div class="box">
                <figure class="image my-4">
                  <img
                    class="max-quarter has-image-centered"
                    src="/images/find-space.png"
                    alt="Man and woman recycling"
                  ></img>
                </figure>
                <p class="title is-3">Find Space</p>
                <p class="subtitle is-5">
                  Make the most of your square footage. Beyond homegoods, you
                  can find or list unused space within your community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="hero p-6 has-background-green">
        <div class="container has-text-centered ">
          <p class="title is-1 is-spaced has-text-light">
            Plus, it's completely free.
          </p>
          <p class="subtitle is-3 has-text-white">
            There's absolutely nothing to lose. So what are you waiting for?
          </p>
          <a
            href="/register"
            class="button is-light is-outlined is-large has-text-bold bold-button"
          >
            Sign up for free
          </a>
        </div>
      </section>
      <footer class="footer pb-6">
        <div class="container has-text-centered">
          <aside class="menu">
            <p class="menu-label">About</p>
            <ul class="menu-list">
              <li>
                <a href="https://github.com/peterrauscher/Neighborly">Github</a>
              </li>
              <li>
                <a href="https://devpost.com/software/neighborly-42ghs1">
                  Devpost
                </a>
              </li>
              <li>
                <a href="https://www.linkedin.com/in/peter-rauscher">
                  Linkedin (I'm seeking a job)
                </a>
              </li>
            </ul>
          </aside>
        </div>
      </footer>
    </>
  );
};

export default Home;
