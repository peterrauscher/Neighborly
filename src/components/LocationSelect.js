import { useState } from "react";
import GooglePlacesAutocomplete from "react-google-places-autocomplete";

const POPULAR_NEIGHBORHOODS = [
  { label: "Seattle, WA, USA", value: { place_id: "ChIJVTPokUsQkFQR29GelWAxqGc" } },
  { label: "Brooklyn, New York, NY, USA", value: { place_id: "ChIJCSF8lBZEwokRhngABHRcdoU" } },
  { label: "Austin, TX, USA", value: { place_id: "ChIJLwRrcBm1RIYMgxNYaPgCdHQ" } },
  { label: "San Francisco, CA, USA", value: { place_id: "ChIJIQBpAG2ahYAR_6128GcTUEo" } },
  { label: "Chicago, IL, USA", value: { place_id: "ChIJ7cv00DwsDogRAMDACa2m4K8" } },
  { label: "Denver, CO, USA", value: { place_id: "ChIJzPO8fq6_bIcR0nlIfLsKpEI" } },
  { label: "Portland, OR, USA", value: { place_id: "ChIJ44R74U0wlVQRb68488-w_68" } },
];

const LocationSelect = ({ neighborhood, setNeighborhood }) => {
  const [useFallback, setUseFallback] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const apiKey = process.env.REACT_APP_GOOGLE_PLACES_API_KEY || "AIzaSyDIWTjVRuyMlTGpP47w8CbO91dOoGgRFPE";

  const handleSelectPreset = (e) => {
    const val = e.target.value;
    if (!val) return;
    const found = POPULAR_NEIGHBORHOODS.find((p) => p.value.place_id === val);
    if (found) {
      setNeighborhood(found);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const slug = customInput.toLowerCase().replace(/[^a-z0-9]/g, "-");
    setNeighborhood({
      label: customInput.trim(),
      value: { place_id: `custom_${slug}` },
    });
    setCustomInput("");
  };

  if (useFallback) {
    return (
      <div className="location-select-fallback">
        <div className="select is-fullwidth mb-2">
          <select
            value={neighborhood ? neighborhood.placeId : ""}
            onChange={handleSelectPreset}
          >
            <option value="">
              {neighborhood ? neighborhood.label : "Select neighborhood..."}
            </option>
            {POPULAR_NEIGHBORHOODS.map((item) => (
              <option key={item.value.place_id} value={item.value.place_id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={handleCustomSubmit} className="is-flex">
          <input
            className="input is-small"
            type="text"
            placeholder="Or type custom city..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
          />
          <button type="submit" className="button is-small is-dark ml-1">
            Set
          </button>
        </form>
      </div>
    );
  }

  return (
    <GooglePlacesAutocomplete
      apiKey={apiKey}
      apiOptions={{ language: "en", region: "us" }}
      selectProps={{
        placeholder: neighborhood ? neighborhood.label : "I live in...",
        onChange: setNeighborhood,
      }}
      debounce={200}
      autocompletionRequest={{
        types: ["(cities)"],
        componentRestrictions: {
          country: ["us"],
        },
      }}
      onLoadFailed={(e) => {
        console.warn("Google Maps script failed or billing disabled, switching to neighborhood selector:", e);
        setUseFallback(true);
      }}
    />
  );
};

export default LocationSelect;
