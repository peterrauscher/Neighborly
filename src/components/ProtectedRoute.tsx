import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { safeRedirectTarget } from "../lib/api";

import { Button } from "./ui/Primitives";

export type ProtectedRouteProps = {
	children?: ReactNode;
};

function SessionRecovery() {
	const { state, retrySession } = useAuth();
	const isLoading = state.status === "loading";
	const message =
		state.status === "offline"
			? "You appear to be offline. Reconnect, then try again."
			: state.status === "error"
				? state.error.message
				: "Restoring your secure session.";

	return (
		<main aria-busy={isLoading} aria-live="polite">
			<h1>{isLoading ? "Restoring session" : "Session unavailable"}</h1>
			<p role={isLoading ? undefined : "alert"}>{message}</p>
			{!isLoading && (
				<Button onClick={() => void retrySession()} variant="secondary">
					Try again
				</Button>
			)}
		</main>
	);
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
	const { state } = useAuth();
	const location = useLocation();

	if (
		state.status === "loading" ||
		state.status === "offline" ||
		state.status === "error"
	) {
		return <SessionRecovery />;
	}
	if (state.status === "authenticated") {
		return children ? <>{children}</> : <Outlet />;
	}

	const redirect = `${location.pathname}${location.search}${location.hash}`;
	const search = new URLSearchParams({ redirect }).toString();
	return <Navigate replace to={{ pathname: "/login", search: `?${search}` }} />;
}
