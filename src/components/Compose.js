/* eslint-disable jsx-a11y/anchor-is-valid */
import { useMutation } from "@apollo/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Resizer from "react-image-file-resizer";
import { useContext, useState } from "react";
import { UserContext } from "../contexts/UserContext";
import { INSERT_ONE_POST } from "../realm/graphql";
import { useModal } from "contexts/ModalContext";
import Loading from "./Loading";
import Alert from "./Alert";

const Compose = ({ setShouldReload = null }) => {
  const [postType, setPostType] = useState("lend");
  const [postBody, setPostBody] = useState("");
  const [files, setFiles] = useState([]);
  const { user, firebaseStorage } = useContext(UserContext);
  const { showModal, setModalTimeout } = useModal();
  const [insertOnePost, { data, loading, error }] =
    useMutation(INSERT_ONE_POST);

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

  const generateUniqueFileName = () =>
    `${Math.random().toString(36).substring(2, 7)}_${new Date().getTime()}.jpg`;

  const handleNewPost = async (e) => {
    e.preventDefault();
    showModal(<Loading />);
    if (files.length > 5) {
      console.error("Exceeded maximum number of images");
      showModal(
        <Alert
          type="danger"
          title="Post Error"
          message="You are only allowed to upload 5 images per post."
        />
      );
    } else {
      const images = await Promise.all(
        files.map(async (file) => {
          const fileName = generateUniqueFileName();
          const fileRef = ref(firebaseStorage, `images/${fileName}`);
          await uploadBytes(fileRef, file);
          return getDownloadURL(fileRef);
        })
      );

      insertOnePost({
        variables: {
          data: {
            authorId: user.id.toString(),
            neighborhood: user.customData.neighborhood,
            images: images,
            content: postBody,
            postType: postType,
            postedAt: new Date(),
          },
        },
        onCompleted: () => {
          setPostBody("");
          // @ts-ignore
          document.getElementById("file-input").files.value = "";
          showModal(
            <Alert
              type="success"
              title="Success"
              message="Your post was published!"
            />
          );
          setModalTimeout(1);
          if (setShouldReload) setShouldReload(true);
        },
        onError: () => {
          console.error(error);
          showModal(
            <Alert type="danger" title="Post Error" message={error.message} />
          );
        },
      });
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
          alt="Your avatar"
          src={user.customData.avatar}
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
        <div className={`file ${files.length > 0 ? "has-name" : ""}`}>
          <label className="file-label">
            <input
              className="file-input"
              type="file"
              multiple={true}
              id="file-input"
              accept="image/png, image/jpeg"
              onChange={async (e) => {
                try {
                  Promise.all(
                    Array.from(e.currentTarget.files).map(
                      (file) =>
                        new Promise((resolve) => {
                          Resizer.imageFileResizer(
                            file,
                            1024,
                            1024,
                            "JPEG",
                            70,
                            0,
                            (uri) => {
                              resolve(uri);
                            },
                            "file",
                            300,
                            300
                          );
                        })
                    )
                  ).then((resizedFiles) => setFiles(resizedFiles));
                } catch (err) {
                  console.log(err);
                }
              }}
            />
            <span className="file-cta">
              <span className="file-icon">
                <i className="fas fa-camera"></i>
              </span>
              <span className="file-label">Add Photos</span>
            </span>
            {files.length > 0 && (
              <span className="file-name">{files.length} of 5 Max</span>
            )}
          </label>
        </div>
        <button className="button is-rounded is-orange" onClick={handleNewPost}>
          <span className="icon is-small">
            <i className="fa fa-plus"></i>
          </span>
          <span>Publish</span>
        </button>
      </div>
    </div>
  );
};

export default Compose;
