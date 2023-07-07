import { useEffect, useMemo, useRef, useState } from "react";
import { useScript } from "@uidotdev/usehooks";


const LocationSelect = () => {
  const locationRef = useRef();
  const autoCompleteRef = useRef();
  const [locationQuery, setLocationQuery] = useState("");
  const scriptStatus = useScript(`https://maps.googleapis.com/maps/api/js?language=en&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`);

  const options = useMemo(
    () => ({
      componentRestrictions: { country: "at" },
      fields: ["address_components", "geometry", "name"],
      types: ["cities"],
    }),
    []
  )
  useEffect(() => {
    // Conditions to ensure that no multiple instances of the
    // Google Places API class and event listener exist.
    if (
      autoCompleteRef.current ||
      scriptStatus === "loading" ||
      !locationRef.current ||
      !window.google ||
      !window.google.maps ||
      !window.google.maps.places
    ) {
      return
    }
    if (scriptStatus === "error") { return }
    autoCompleteRef.current = new window.google.maps.places.AutoComplete(
      locationRef.current,
      options
    );
    autoCompleteRef.current.addListener("place_changed", () => {
      if (!autoCompleteRef.current) {
        return
      }
      // Retrieve the selected location with the `getPlace` method.
      onChange(autoCompleteRef.current.getPlace())
    })
  }, [scriptStatus, options])

  return (
    <>
      <div className="control has-icons-left">
        <div className="icon is-small is-left">
          <i className="fas fa-location-dot"></i>
        </div>
        <input
          type="text"
          ref={locationRef}
          placeholder="I live in..."
          className="input is-rounded"
        />
      </div>
    </>
  );
};

export default LocationSelect;
