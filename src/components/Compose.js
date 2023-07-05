/* eslint-disable jsx-a11y/anchor-is-valid */
import { useContext, useState } from "react";
import { useMutation } from "@apollo/client";
import { INSERT_ONE_POST } from "../realm/graphql";
import { UserContext } from "../contexts/UserContext";
import Modal from "./Modal";

const Compose = () => {
  const [postType, setPostType] = useState("lend");
  const [postBody, setPostBody] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const { user } = useContext(UserContext);
  const [insertOnePost] = useMutation(INSERT_ONE_POST);

  const setActive = (e) => {
    e.preventDefault();
    document
      .querySelectorAll(
        "div.card.publish > div.tabs.is-boxed.is-fullwidth > ul > li"
      )
      .forEach((el) => el.classList.remove("is-active"));
    e.currentTarget.classList.add("is-active");
    setPostType(e.currentTarget.getAttribute("data-target"));
  };

  const handleNewPost = async (e) => {
    e.preventDefault();
    try {
      await insertOnePost({
        variables: {
          data: {
            authorId: user.id,
            content: postBody,
            postType: postType,
            postedAt: new Date(),
          },
        },
      });
      setPostBody("");
      setModalContent(<p className="title is-1">Thanks for sharing!</p>);
      setShowModal(true);
    } catch (error) {
      setModalContent(
        <p className="title is-1">Uh oh! Something went wrong on our end.</p>
      );
      setShowModal(true);
      console.error(error);
    }
  };

  let placeholder;
  switch (postType) {
    case "lend":
      placeholder = "I'm lending out my...";
      break;
    case "borrow":
      placeholder = "I need to borrow...";
      break;
    case "trade":
      placeholder = "I'm looking to trade my ___ for...";
      break;
    default:
  }

  return (
    <div className="card publish">
      <div className="tabs is-boxed is-fullwidth">
        <ul>
          <li
            onClick={setActive}
            data-target="lend"
            key="lend"
            className="is-active"
          >
            <a>
              <span className="icon is-small">
                <i className="fa fa-hand-holding-heart"></i>
              </span>
              <span> Lend</span>
            </a>
          </li>
          <li onClick={setActive} data-target="borrow" key="borrow">
            <a>
              <span className="icon is-small">
                <i className="fa fa-hands-holding-circle"></i>
              </span>
              <span> Borrow</span>
            </a>
          </li>
          <li onClick={setActive} data-target="trade" key="trade">
            <a>
              <span className="icon is-small">
                <i className="fa fa-hand-holding-hand"></i>
              </span>
              <span> Trade</span>
            </a>
          </li>
        </ul>
      </div>
      <div className="compose">
        <img
          className="avatar"
          alt="Your uploaded avatar"
          src="https://via.placeholder.com/96"
        ></img>
        <div className="control">
          <textarea
            className="textarea"
            onChange={(e) => setPostBody(e.currentTarget.value)}
            value={postBody}
            placeholder={placeholder}
          ></textarea>
        </div>
      </div>
      <div className="options">
        <button className="button is-rounded">
          <span className="icon is-small">
            <i className="fa fa-camera"></i>
          </span>
          <span>Media</span>
        </button>
        <button className="button is-rounded" onClick={handleNewPost}>
          <span className="icon is-small">
            <i className="fa fa-plus"></i>
          </span>
          <span>Publish</span>
        </button>
      </div>
      <Modal
        open={showModal}
        setOpen={setShowModal}
        content={modalContent}
      ></Modal>
    </div>
  );
};

export default Compose;
