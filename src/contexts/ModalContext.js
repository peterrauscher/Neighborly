import React, { createContext, useContext, useEffect, useState } from "react";

const ModalContext = createContext(null);

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTimeout, setModalTimeout] = useState(null);
  const [modalContent, setModalContent] = useState("");

  const showModal = (content) => {
    setModalContent(content);
    setIsModalVisible(true);
  };

  const hideModal = () => {
    setModalContent("");
    setIsModalVisible(false);
  };

  useEffect(() => {
    if (modalTimeout) {
      setTimeout(() => {
        setIsModalVisible(false);
        setModalTimeout(null);
      }, 1000 * modalTimeout);
    }
  }, [modalTimeout]);

  return (
    <ModalContext.Provider
      value={{
        showModal,
        hideModal,
        isModalVisible,
        modalContent,
        setModalTimeout,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};
