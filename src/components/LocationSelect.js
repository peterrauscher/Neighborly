import { useState } from "react";
import GooglePlacesAutocomplete from "react-google-places-autocomplete";

const LocationSelect = ({ neighborhood, setNeighborhood }) => {
  const [lockedIn, setLockedIn] = useState(false);

  return (
    <GooglePlacesAutocomplete
      apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
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
