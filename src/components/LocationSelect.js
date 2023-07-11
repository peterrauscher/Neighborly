import { useState } from "react";
import GooglePlacesAutocomplete from "react-google-places-autocomplete";

const LocationSelect = ({ neighborhood, setNeighborhood }) => {
  const [lockedIn, setLockedIn] = useState(false);

  return (
    <GooglePlacesAutocomplete
      apiKey="AIzaSyDIWTjVRuyMlTGpP47w8CbO91dOoGgRFPE"
      apiOptions={{ language: "en", region: "us" }}
      selectProps={{
        placeholder: neighborhood ? neighborhood.label : "I live in...",
        onChange: setNeighborhood,
        isDisabled: lockedIn,
      }}
      debounce={200}
      autocompletionRequest={{
        types: ["(cities)"],
        componentRestrictions: {
          country: ["us"],
        },
      }}
      onLoadFailed={(e) =>
        console.error("Could not inject Google Maps script", e)
      }
    />
  );
};

export default LocationSelect;
