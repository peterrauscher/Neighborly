import { Outlet } from "react-router-dom";
import Navigation from "./Navigation";
import Modal from "./Modal";
import Footer from "./Footer";

const Layout = () => {
  return (
    <>
      <Navigation />
      <Outlet />
      <Footer />
      <Modal />
    </>
  );
};

export default Layout;
