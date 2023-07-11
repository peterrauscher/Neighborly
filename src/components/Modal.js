import React from "react";
import { useModal } from "contexts/ModalContext";

const Modal = () => {
  const { isModalVisible, modalContent, hideModal } = useModal();

  return (
    <div className={`modal ${isModalVisible ? "is-active" : ""}`}>
      <div className="modal-background" onClick={hideModal}></div>
      <div className="modal-content has-text-centered">{modalContent}</div>
      <button
        className="modal-close is-large"
        aria-label="close"
        onClick={hideModal}
      ></button>
    </div>
  );
};

export default Modal;
