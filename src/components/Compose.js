/* eslint-disable jsx-a11y/anchor-is-valid */
import { useMutation } from "@apollo/client";
import { useContext, useState } from "react";
import { UserContext } from "../contexts/UserContext";
import { INSERT_ONE_POST } from "../realm/graphql";
import Loading from "./Loading";

const Compose = ({ setShouldReload = null }) => {
  const [postType, setPostType] = useState("lend");
  const [postBody, setPostBody] = useState("");
  const { user } = useContext(UserContext);
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

  const generateUniqueFileName = (file) => {
    const timestamp = new Date().getTime();
    const randomString = Math.random().toString(36).substring(2, 7);
    const fileName = `${timestamp}_${randomString}_${file.name}`;
    return fileName;
  };

  const uploadToStorage = (file, fileName) => {
    return new Promise((resolve, reject) => {
      const storage = firebase.storage();
      const storageRef = storage.ref();
      const fileRef = storageRef.child(fileName);

      const uploadTask = fileRef.put(file);

      uploadTask.on(
        "state_changed",
        null,
        (error) => {
          reject(error);
        },
        () => {
          uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
  };

  const handleNewPost = async (e) => {
    e.preventDefault();

    // Perform image upload to Google Cloud Storage
    const fileInput = document.getElementById("file-input");
    const files = fileInput.files;
    const images = [];

    if (files.length > 5) {
      // Display an error message or show an error modal
      console.error("Exceeded maximum number of images");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 2 * 1024 * 1024) {
        // Display an error message or show an error modal
        console.error("File size exceeds maximum limit");
        return;
      }
      const fileName = generateUniqueFileName(file);
      const imageUrl = await uploadToStorage(file, fileName);
      images.push(imageUrl);
    }

    insertOnePost({
      variables: {
        data: {
          authorId: user.id.toString(),
          neighborhood: user.customData.neighborhood,
          content: postBody,
          postType: postType,
          postedAt: new Date(),
        },
      },
      onCompleted: () => {
        setPostBody("");
        fileInput.value = ""; // Clear file input
        if (setShouldReload) setShouldReload(true);
      },
      onError: () => {
        console.error(error);
      },
    });
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
        <div className="file">
          <label className="file-label">
            <input
              className="file-input"
              type="file"
              multiple={true}
              accept="image/png, image/jpeg"
            />
            <span className="file-cta">
              <span className="file-icon">
                <i className="fas fa-camera"></i>
              </span>
              <span className="file-label">Add Photos</span>
            </span>
          </label>
        </div>
        <button className="button is-rounded is-green" onClick={handleNewPost}>
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
