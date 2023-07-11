import Alert from "components/Alert";
import { useModal } from "contexts/ModalContext";
import { useState } from "react";

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { showModal, setModalTimeout } = useModal();

  const handleSubmit = (event) => {
    event.preventDefault();

    const data = {
      name: name,
      email: email,
    };

    fetch(
      "https://us-central1-neighborly-388205.cloudfunctions.net/sendContactUsEmail",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    )
      .then((result) => {
        console.log("Success:", result);
        showModal(
          <Alert
            type="success"
            title="Request Recevied"
            message="I've received your request and I'll be sure to get back to you as soon as possible."
          />
        );
        setModalTimeout(2000);
        setName("");
        setEmail("");
        setMessage("");
      })
      .catch((error) => {
        console.error(error);
      });
  };

  return (
    <section className="hero contact-hero is-fullheight-with-navbar">
      <div className="hero-body">
        <div className="container has-text-centered">
          <div className="columns is-8 is-variable ">
            <div className="column is-two-thirds has-text-left">
              <h1 className="title is-1">Contact Us</h1>
              <p className="is-size-4">
                It's just me here at Neighborly! Whether you have a question,
                feedback, or simply want to say hello, feel free to reach out to
                me using the contact form, and I'll get back to you as soon as I
                can. You can also reach me on Github by creating an issue or by
                messaging me on Linkedin. Thank you for being a part of the
                Neighborly community!
              </p>
              <div className="social-media">
                <a href="https://github.com/peterrauscher/Neighborly">
                  <span className="icon is-large">
                    <i className="fa fa-github" aria-hidden="true"></i>
                  </span>
                </a>
                <a href="https://linkedin.com/in/peter-rauscher">
                  <span className="icon is-large">
                    <i className="fa fa-linkedin" aria-hidden="true"></i>
                  </span>
                </a>
              </div>
            </div>
            <div className="column is-one-third has-text-left">
              <div className="contact-field">
                <label className="label">Name</label>
                <div className="control">
                  <input
                    className="input is-medium"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              </div>
              <div className="contact-field">
                <label className="label">Email</label>
                <div className="control">
                  <input
                    className="input is-medium"
                    type="text"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>
              <div className="contact-field">
                <label className="label">Message</label>
                <div className="control">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="textarea is-medium"
                  ></textarea>
                </div>
              </div>
              <div className="control">
                <button
                  type="submit"
                  className="button is-link is-fullwidth has-text-weight-medium is-medium"
                  onClick={handleSubmit}
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
