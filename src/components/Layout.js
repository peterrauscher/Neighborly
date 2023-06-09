import { Outlet } from "react-router-dom";
import Navigation from "./Navigation";
import Modal from "./Modal";

const Layout = () => {
  return (
    <>
      <Navigation />
      <Outlet />
      <Modal />
    </>
  );
};

export default Layout;
