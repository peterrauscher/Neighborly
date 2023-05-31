import { Outlet } from "react-router-dom";
import Navigation from "./Navigation";

const Layout = () => {
  return (
    <>
      <Navigation />
      <section class="container">
        <Outlet />
      </section>
    </>
  );
};
export default Layout;
