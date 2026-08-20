import { useCallback, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

import { SiteFooter } from "./SiteFooter";
import { SiteNavigation } from "./SiteNavigation";
import styles from "./SiteShell.module.css";
import { InlineAlert } from "./ui/Primitives";

const MAIN_CONTENT_ID = "main-content";

/** Layout for public routes. Route content is supplied by React Router's Outlet. */
export function MarketingLayout() {
	return (
		<div className={styles.marketingShell}>
			<a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`}>
				Skip to main content
			</a>
			<SiteNavigation variant="marketing" />
			<div id={MAIN_CONTENT_ID} className={styles.marketingMain} tabIndex={-1}>
				<Outlet />
			</div>
			<SiteFooter />
		</div>
	);
}

/** Layout for member-only routes. ProtectedRoute owns the authentication gate. */
export function AppShell() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [logoutError, setLogoutError] = useState<string | null>(null);
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	const handleLogout = useCallback(async () => {
		setLogoutError(null);
		setIsLoggingOut(true);

		try {
			await logout();
			navigate("/", { replace: true });
		} catch {
			setLogoutError("We couldn't sign you out. Please try again.");
		} finally {
			setIsLoggingOut(false);
		}
	}, [logout, navigate]);

	return (
		<div className={styles.appShell}>
			<a className={styles.skipLink} href={`#${MAIN_CONTENT_ID}`}>
				Skip to main content
			</a>
			<SiteNavigation
				isLoggingOut={isLoggingOut}
				onLogout={handleLogout}
				user={user}
				variant="app"
			/>
			<div id={MAIN_CONTENT_ID} className={styles.appMain} tabIndex={-1}>
				{logoutError && (
					<div className={styles.shellAlert}>
						<InlineAlert
							onClose={() => setLogoutError(null)}
							title="Sign out didn't complete"
							variant="error"
						>
							{logoutError}
						</InlineAlert>
					</div>
				)}
				<Outlet />
			</div>
			<SiteFooter />
		</div>
	);
}
