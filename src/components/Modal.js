import { useEffect, useState } from "react";

const Modal = ({ content = null, open = false, modalId = "page-modal" }) => {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    document.addEventListener("keydown", (event) => {
      const e = event || window.event;
      if (e.keyCode === 27) {
        setIsOpen(false);
      }
    });
  });

  return (
    <div id={modalId} className={"modal" + (isOpen ? " is-active" : "")}>
      <div className="modal-background"></div>

      <div className="modal-content">
        <div className="box"></div>
      </div>
      {content && content}
      <button className="modal-close is-large" aria-label="close"></button>
    </div>
  );
};

export default Modal;
