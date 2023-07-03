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

const App = () => {
  return (
    <UserProvider>
      <Router>
        <NavProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<DefaultErrorPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/feed" element={<Feed />} />
            </Route>
          </Routes>
        </NavProvider>
      </Router>
    </UserProvider>
  );
};

export default App;
