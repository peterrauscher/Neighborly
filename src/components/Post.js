import { useCallback, useRef, useState } from "react";
import ReactTimeAgo from "react-time-ago";
import LightGallery from "lightgallery/react";

import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-thumbnail.css";

const Post = ({ post }) => {
  const lightGallery = useRef(null);
  const [galleryContainer, setGalleryContainer] = useState(null);
  console.log(post);
  const gallery =
    post.images && post.images.length > 0
      ? post.images.map((image, index) => {
          return {
            src: image,
            subHtml: `<div class="lightGallery-captions">
                    <h4>Photo ${index + 1} of ${post.images.length}</h4>
                  </div>`,
          };
        })
      : null;

  const onInit = useCallback((detail) => {
    if (detail && gallery) {
      lightGallery.current = detail.instance;
      lightGallery.current.openGallery();
    }
  }, []);

  const setContainerRef = useCallback((node) => {
    if (node !== null) setGalleryContainer(node);
  }, []);

  const getLgComponent = () => {
    if (galleryContainer !== null && gallery !== null) {
      return (
        <LightGallery
          keyPress={false}
          dynamic
          dynamicEl={gallery}
          closable={false}
          showMaximizeIcon
          onInit={onInit}
          container={galleryContainer}
        ></LightGallery>
      );
    }
    return <></>;
  };

  return (
    <div className="card post">
      <div className="post-top">
        <div className="post-avatar">
          <img
            className="avatar"
            src={post.author.avatar}
            alt={`${post.author.name}'s avatar`}
          />
        </div>
        <div className="post-content">
          <div className="post-author">
            <div>
              <a href={`/user/${post.author.accountId}`}>{post.author.name}</a>
              <p className="post-time">
                <ReactTimeAgo date={post.postedAt} locale="en-US" />
              </p>
            </div>
          </div>
          <div className="content">{post.content}</div>
        </div>
      </div>
      {post.images && post.images.length > 0 && (
        <>
          <div
            className="gallery has-text-centered"
            ref={setContainerRef}
          ></div>
          {getLgComponent()}
        </>
      )}
    </div>
  );
};

export default Post;
