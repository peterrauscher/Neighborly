import {
	CloudSlash,
	House,
	MagnifyingGlass,
	WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SiteFooter } from "../components/SiteFooter";
import { SiteNavigation } from "../components/SiteNavigation";
import styles from "../components/SiteShell.module.css";

export type AppErrorPageProps = {
	kind?: "not-found" | "error";
};

export function AppErrorPage({ kind = "error" }: AppErrorPageProps) {
	const [isOffline, setIsOffline] = useState(
		typeof navigator !== "undefined" && navigator.onLine === false,
	);
	const isNotFound = kind === "not-found";

	useEffect(() => {
		const markOffline = () => setIsOffline(true);
		const markOnline = () => setIsOffline(false);

		window.addEventListener("offline", markOffline);
		window.addEventListener("online", markOnline);
		return () => {
			window.removeEventListener("offline", markOffline);
			window.removeEventListener("online", markOnline);
		};
	}, []);

	const content = isOffline
		? {
				icon: <CloudSlash aria-hidden="true" size={38} weight="duotone" />,
				title: "You're offline",
				description: "Reconnect to the internet, then try this page again.",
				action: "Try again",
			}
		: isNotFound
			? {
					icon: (
						<MagnifyingGlass aria-hidden="true" size={38} weight="duotone" />
					),
					title: "That page isn't here",
					description:
						"The link may be out of date, or the page may have moved. You can return home and keep exploring.",
					action: "Go home",
				}
			: {
					icon: <WarningCircle aria-hidden="true" size={38} weight="duotone" />,
					title: "We couldn't load this page",
					description:
						"Please try again. If this keeps happening, contact us and include what you were trying to do.",
					action: "Try again",
				};

	return (
		<div className={styles.errorShell}>
			<a className={styles.skipLink} href="#main-content">
				Skip to main content
			</a>
			<SiteNavigation variant="marketing" />
			<main className={styles.errorMain} id="main-content" tabIndex={-1}>
				<section
					className={styles.errorPanel}
					aria-labelledby="error-page-title"
				>
					<div className={styles.errorIcon}>{content.icon}</div>
					<p className={styles.errorEyebrow}>Neighborly</p>
					<h1 id="error-page-title">{content.title}</h1>
					<p>{content.description}</p>
					<div className={styles.errorActions}>
						{isNotFound ? (
							<Link className={styles.errorPrimaryAction} to="/">
								<House aria-hidden="true" size={18} weight="bold" />
								{content.action}
							</Link>
						) : (
							<button
								className={styles.errorPrimaryAction}
								onClick={() => window.location.reload()}
								type="button"
							>
								{content.action}
							</button>
						)}
						<Link className={styles.errorSecondaryAction} to="/contact">
							Contact us
						</Link>
					</div>
				</section>
			</main>
			<SiteFooter />
		</div>
	);
}

export default AppErrorPage;
