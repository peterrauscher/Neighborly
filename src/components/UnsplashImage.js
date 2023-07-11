import React, { useState, useEffect } from "react";
import axios from "axios";

const UnsplashImage = ({ searchTerm, elementClasses = "" }) => {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (searchTerm) {
      // const apiUrl = `https://api.unsplash.com/photos/random?client_id=g1KQl19jGPi4w6JsayOGfoT_QS1ee8VgT0GSWlpM5bk&query=${searchTerm}&orientation=landscape`;
      // axios.get(apiUrl).then((response) => {
      //   setImage(response.data.urls["regular"]);
      // });
    }
  }, [searchTerm]);

  return (
    <img
      className={elementClasses}
      src="https://images.unsplash.com/photo-1524813686514-a57563d77965?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1332&q=80"
      // src={image}
      alt={"Search result from Unsplash for: " + searchTerm}
    />
  );
};

export default UnsplashImage;
