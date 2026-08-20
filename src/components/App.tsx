import { Component, Suspense, lazy, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { AuthProvider } from "../contexts/AuthContext";
import { AppErrorPage } from "../pages/AppErrorPage";
import ProtectedRoute from "./ProtectedRoute";
import { AppShell, MarketingLayout } from "./SiteShell";

const HomePage = lazy(() =>
	import("../pages/HomePage").then(({ HomePage: Page }) => ({ default: Page })),
);
const LoginPage = lazy(() =>
	import("../pages/AuthPages").then(({ LoginPage: Page }) => ({
		default: Page,
	})),
);
const RegisterPage = lazy(() =>
	import("../pages/AuthPages").then(({ RegisterPage: Page }) => ({
		default: Page,
	})),
);
const ContactPage = lazy(() =>
	import("../pages/ContactPage").then(({ ContactPage: Page }) => ({
		default: Page,
	})),
);
const LegalPage = lazy(() =>
	import("../pages/LegalPage").then(({ LegalPage: Page }) => ({
		default: Page,
	})),
);
const OnboardingPage = lazy(() =>
	import("../pages/OnboardingPage").then(({ OnboardingPage: Page }) => ({
		default: Page,
	})),
);
const FeedPage = lazy(() => import("../pages/FeedPage"));
const ListingEditorPage = lazy(() =>
	import("../pages/ListingEditorPage").then(({ ListingEditorPage: Page }) => ({
		default: Page,
	})),
);
const ListingDetailPage = lazy(() =>
	import("../pages/ListingDetailPage").then(({ ListingDetailPage: Page }) => ({
		default: Page,
	})),
);
const ActivityPage = lazy(() =>
	import("../pages/ActivityPage").then(({ ActivityPage: Page }) => ({
		default: Page,
	})),
);
const MemberProfilePage = lazy(() =>
	import("../pages/MemberProfilePage").then(({ MemberProfilePage: Page }) => ({
		default: Page,
	})),
);
const AccountPage = lazy(() =>
	import("../pages/AccountPage").then(({ AccountPage: Page }) => ({
		default: Page,
	})),
);

const MAIN_CONTENT_ID = "main-content";

type RouteErrorBoundaryProps = {
	children: ReactNode;
	resetKey: string;
};

type RouteErrorBoundaryState = {
	hasError: boolean;
};

class RouteErrorBoundary extends Component<
	RouteErrorBoundaryProps,
	RouteErrorBoundaryState
> {
	state: RouteErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): RouteErrorBoundaryState {
		return { hasError: true };
	}

	componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
		if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
			this.setState({ hasError: false });
		}
	}

	render() {
		return this.state.hasError ? (
			<AppErrorPage kind="error" />
		) : (
			this.props.children
		);
	}
}

function RouteLoading() {
	return (
		<main className="routeLoading" aria-busy="true">
			<output>Loading page…</output>
		</main>
	);
}

function routeElement(page: ReactNode) {
	return <Suspense fallback={<RouteLoading />}>{page}</Suspense>;
}

function titleForPathname(pathname: string) {
	if (pathname === "/") return "Neighborly | Share more, waste less";
	if (pathname === "/login") return "Sign in | Neighborly";
	if (pathname === "/register") return "Create an account | Neighborly";
	if (pathname === "/contact") return "Contact | Neighborly";
	if (pathname === "/privacy") return "Privacy | Neighborly";
	if (pathname === "/terms") return "Terms of use | Neighborly";
	if (pathname === "/onboarding")
		return "Choose your neighborhood | Neighborly";
	if (pathname === "/feed") return "Neighborhood feed | Neighborly";
	if (pathname === "/listings/new") return "Create a listing | Neighborly";
	if (/^\/listings\/[^/]+\/edit$/.test(pathname)) {
		return "Edit listing | Neighborly";
	}
	if (/^\/listings\/[^/]+$/.test(pathname)) {
		return "Listing | Neighborly";
	}
	if (pathname === "/activity") return "Activity | Neighborly";
	if (/^\/neighbors\/[^/]+$/.test(pathname)) {
		return "Neighbor profile | Neighborly";
	}
	if (pathname === "/account") return "Account | Neighborly";
	return "Page not found | Neighborly";
}

function AppRoutes() {
	const { hash, pathname } = useLocation();

	useEffect(() => {
		document.title = titleForPathname(pathname);
	}, [pathname]);

	const previousLocationRef = useRef<{ hash: string; pathname: string } | null>(
		null,
	);

	useEffect(() => {
		const previousLocation = previousLocationRef.current;
		previousLocationRef.current = { hash, pathname };

		if (!previousLocation) return;
		if (
			previousLocation.hash === hash &&
			previousLocation.pathname === pathname
		) {
			return;
		}

		let targetId = "";
		if (hash.length > 1) {
			try {
				targetId = decodeURIComponent(hash.slice(1));
			} catch {
				targetId = "";
			}
		}

		const focusHashTarget = () => {
			if (!targetId) return false;

			const target = document.getElementById(targetId);
			if (!(target instanceof HTMLElement)) return false;

			target.scrollIntoView({ behavior: "auto", block: "start" });
			target.focus({ preventScroll: true });
			return true;
		};
		const focusMain = () => {
			document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
			window.scrollTo({ behavior: "auto", left: 0, top: 0 });
		};

		if (focusHashTarget()) return;

		let observer: MutationObserver | undefined;
		let fallbackTimer: number | undefined;
		const stopObserving = () => {
			observer?.disconnect();
			if (fallbackTimer !== undefined) {
				window.clearTimeout(fallbackTimer);
				fallbackTimer = undefined;
			}
		};
		const frame = window.requestAnimationFrame(() => {
			if (targetId) {
				if (focusHashTarget()) return;

				const appRoot = document.getElementById("root");
				if (appRoot) {
					observer = new MutationObserver(() => {
						if (focusHashTarget()) stopObserving();
					});
					observer.observe(appRoot, { childList: true, subtree: true });
					fallbackTimer = window.setTimeout(() => {
						stopObserving();
						if (previousLocation.pathname !== pathname) focusMain();
					}, 1_000);
					return;
				}
			}

			if (previousLocation.pathname !== pathname) focusMain();
		});

		return () => {
			window.cancelAnimationFrame(frame);
			stopObserving();
		};
	}, [hash, pathname]);

	return (
		<RouteErrorBoundary resetKey={pathname}>
			<Routes>
				<Route element={<MarketingLayout />}>
					<Route index element={routeElement(<HomePage />)} />
					<Route path="login" element={routeElement(<LoginPage />)} />
					<Route path="register" element={routeElement(<RegisterPage />)} />
					<Route path="contact" element={routeElement(<ContactPage />)} />
					<Route
						path="privacy"
						element={routeElement(<LegalPage mode="privacy" />)}
					/>
					<Route
						path="terms"
						element={routeElement(<LegalPage mode="terms" />)}
					/>
				</Route>

				<Route element={<ProtectedRoute />}>
					<Route element={<AppShell />}>
						<Route
							path="onboarding"
							element={routeElement(<OnboardingPage />)}
						/>
						<Route path="feed" element={routeElement(<FeedPage />)} />
						<Route
							path="listings/new"
							element={routeElement(<ListingEditorPage />)}
						/>
						<Route
							path="listings/:id/edit"
							element={routeElement(<ListingEditorPage />)}
						/>
						<Route
							path="listings/:id"
							element={routeElement(<ListingDetailPage />)}
						/>
						<Route path="activity" element={routeElement(<ActivityPage />)} />
						<Route
							path="neighbors/:id"
							element={routeElement(<MemberProfilePage />)}
						/>
						<Route path="account" element={routeElement(<AccountPage />)} />
					</Route>
				</Route>

				<Route path="*" element={<AppErrorPage kind="not-found" />} />
			</Routes>
		</RouteErrorBoundary>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<AppRoutes />
			</AuthProvider>
		</BrowserRouter>
	);
}
