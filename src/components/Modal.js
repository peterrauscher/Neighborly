import { useEffect, useState } from "react";

const Modal = ({
  content = null,
  open = false,
  setOpen = (b) => {},
  modalId = "page-modal",
}) => {
  useEffect(() => {
    document.addEventListener("keydown", (event) => {
      const e = event || window.event;
      if (e.keyCode === 27) {
        setOpen(false);
      }
    });
  });

  return (
    <div id={modalId} className={"modal" + (open ? " is-active" : "")}>
      <div className="modal-background"></div>
      <div className="modal-content has-text-centered">
        <div className="box">
          <div className="container">{content && content}</div>
        </div>
      </div>
      <button className="modal-close is-large" aria-label="close"></button>
    </div>
  );
};

export default Modal;
