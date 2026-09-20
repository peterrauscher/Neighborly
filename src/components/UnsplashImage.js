import React from "react";

const UnsplashImage = ({ searchTerm, elementClasses = "" }) => {

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
