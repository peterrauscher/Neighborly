import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import { NavProvider } from "../contexts/NavContext";
import { UserProvider } from "../contexts/UserContext";
import DefaultErrorPage from "../pages/DefaultErrorPage";
import Feed from "../pages/Feed";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ApolloWrapper from "../contexts/ApolloWrapper";
import Logout from "pages/Logout";

const App = () => {
  return (
    <UserProvider>
      <ApolloWrapper>
        <Router>
          <NavProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="*" element={<DefaultErrorPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/feed" element={<Feed posts="all" />} />
                  <Route path="/feed/lend" element={<Feed posts="lend" />} />
                  <Route
                    path="/feed/borrow"
                    element={<Feed posts="borrow" />}
                  />
                  <Route path="/feed/trade" element={<Feed posts="trade" />} />
                  {/* <Route path="/user/*" element={<User />} /> */}
                  {/* <Route path="/help" element={<Help />} /> */}
                  {/* <Route path="/contact" element={<Contact />} /> */}
                </Route>
              </Route>
            </Routes>
          </NavProvider>
        </Router>
      </ApolloWrapper>
    </UserProvider>
  );
};

export default App;
