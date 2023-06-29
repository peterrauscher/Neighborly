import { RouterProvider } from "react-router-dom";
import router from "../Routes.js";
import { UserProvider } from "../contexts/user.context.js";
import Loading from "./Loading";

const App = () => {
  return (
    <UserProvider>
      <RouterProvider router={router} fallbackElement={<Loading />} />
    </UserProvider>
  );
};

export default App;
