import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/plus-jakarta-sans/latin.css";

import "./styles/tokens.css";
import "./styles/global.css";
import App from "./components/App";

TimeAgo.addDefaultLocale(en);

const rootElement = document.getElementById("root");

if (!(rootElement instanceof HTMLElement)) {
	throw new Error(
		"Failed to find the root element. Make sure index.html defines #root.",
	);
}

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
