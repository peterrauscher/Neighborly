import { Link } from "react-router-dom";

const Footer = () => {
  return (
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
  );
};

export default Footer;
