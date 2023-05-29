import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    // errorElement: <Error />,
    children: [{ index: true, element: <Home /> }],
  },
  { path: "register", element: <SignUp /> },
  { path: "login", element: <Login /> },
]);

export default router;
