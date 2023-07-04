import { useEffect, useRef, useState } from "react";

const NeighborhoodSelect = () => {
  const locationRef = useRef();
  const [locationQuery, setLocationQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const autocompleteService =
    new window.google.maps.places.AutocompleteService();

  useEffect(() => {
    if (locationQuery) {
      autocompleteService.getPlacePredictions(
        {
          input: locationQuery,
          componentRestrictions: { country: "us" },
          types: ["cities"],
        },
        (results, status) => {
          if (
            status !== window.google.maps.places.PlacesServiceStatus.OK ||
            !results
          ) {
            alert(status);
            return;
          }
          setAutocompleteResults(results.map((result) => result.description));
        }
      );
    }
  }, [locationQuery]);

  return (
    <>
      <div className="control has-icons-left">
        <div className="icon is-small is-left">
          <i className="fas fa-location-dot"></i>
        </div>
        <input
          type="text"
          ref={locationRef}
          value={locationQuery}
          onChange={(e) => setLocationQuery(e.target.value)}
          placeholder="I live in..."
          className="input is-rounded"
        />
      </div>
      <ul>
        {autocompleteResults &&
          autocompleteResults.map((result) => {
            return <li>{result}</li>;
          })}
      </ul>
    </>
  );
};

export default NeighborhoodSelect;
