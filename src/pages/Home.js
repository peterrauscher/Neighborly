import Navigation from "../components/Navigation";
import splashImage from "../images/street-view-color-4x3.jpg";
import "../styles/Home.css";

const Home = () => {
  return (
    <section class="hero is-fullheight is-default is-bold">
      <div class="hero-head has-background-white">
        <Navigation></Navigation>
      </div>
      <div class="hero-body">
        <div class="container has-text-centered">
          <div class="columns">
            <div class="column left">
              <figure class="image is-4by3">
                <img
                  class="splash-img"
                  src={splashImage}
                  alt="Townhouse doors"
                ></img>
              </figure>
            </div>
            <div class="column right has-background-white">
              <h1 class="title is-1">Hey, Neighbor!</h1>
              <h2 class="subtitle is-4">Got a cup of sugar I can borrow?</h2>
              <br />
              <p class="has-text-centered">
                <a class="button is-medium is-info">Learn more</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;
