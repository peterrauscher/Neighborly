import {
	Bell,
	CaretDown,
	List,
	MapPin,
	Newspaper,
	PlusCircle,
	SignOut,
	UserCircle,
} from "@phosphor-icons/react";
import {
	type FocusEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { Link, NavLink } from "react-router-dom";

import type { SelfUser } from "../lib/contracts";

import styles from "./SiteShell.module.css";

export type SiteNavigationProps = {
	variant: "marketing" | "app";
	user?: SelfUser | null;
	onLogout?: () => void;
	isLoggingOut?: boolean;
};

type OpenMenu = "marketing" | "neighborhood" | null;

function navLinkClassName(isActive: boolean) {
	return [styles.navLink, isActive ? styles.navLinkActive : ""]
		.filter(Boolean)
		.join(" ");
}

export function SiteNavigation({
	variant,
	user,
	onLogout,
	isLoggingOut = false,
}: SiteNavigationProps) {
	const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
	const menuId = useId();
	const neighborhoodMenuRef = useRef<HTMLDivElement>(null);
	const marketingMenuRef = useRef<HTMLDivElement>(null);
	const neighborhoodToggleRef = useRef<HTMLButtonElement>(null);
	const marketingToggleRef = useRef<HTMLButtonElement>(null);
	const isApp = variant === "app";
	const isDemo = Boolean(user?.isDemo);
	const isCreateDisabled = !user || isDemo;

	const closeMenu = useCallback(
		(returnFocus = false) => {
			const menuToClose = openMenu;
			setOpenMenu(null);

			if (returnFocus) {
				const toggle =
					menuToClose === "neighborhood"
						? neighborhoodToggleRef.current
						: marketingToggleRef.current;
				toggle?.focus();
			}
		},
		[openMenu],
	);

	useEffect(() => {
		if (!openMenu) return;

		const activeMenu =
			openMenu === "neighborhood"
				? neighborhoodMenuRef.current
				: marketingMenuRef.current;

		const closeOnPointerDown = (event: PointerEvent) => {
			if (
				activeMenu &&
				event.target instanceof Node &&
				!activeMenu.contains(event.target)
			) {
				setOpenMenu(null);
			}
		};

		document.addEventListener("pointerdown", closeOnPointerDown);
		return () =>
			document.removeEventListener("pointerdown", closeOnPointerDown);
	}, [openMenu]);

	const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape" && openMenu) {
			event.preventDefault();
			closeMenu(true);
		}
	};

	const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
		const nextFocus = event.relatedTarget as Node | null;
		if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
			closeMenu();
		}
	};

	const closeFromMenuLink = () => closeMenu();

	return (
		<header className={styles.siteHeader}>
			<div className={styles.headerInner}>
				<Link aria-label="Neighborly home" className={styles.brand} to="/">
					<img alt="Neighborly" src="/images/logo-with-text.svg" />
				</Link>

				{isApp && (
					<div
						className={styles.menuRoot}
						onBlur={handleMenuBlur}
						onKeyDown={handleMenuKeyDown}
						ref={neighborhoodMenuRef}
					>
						<button
							aria-controls={`${menuId}-neighborhood`}
							aria-expanded={openMenu === "neighborhood"}
							className={styles.neighborhoodToggle}
							onClick={() =>
								setOpenMenu((current) =>
									current === "neighborhood" ? null : "neighborhood",
								)
							}
							ref={neighborhoodToggleRef}
							type="button"
						>
							<MapPin aria-hidden="true" size={19} weight="duotone" />
							<span className={styles.neighborhoodLabel}>
								<span className={styles.neighborhoodEyebrow}>Neighborhood</span>
								<span>{user?.neighborhood.name ?? "Neighborhood"}</span>
							</span>
							{isDemo && (
								<span
									className={styles.demoBadge}
									title="Read-only demo account"
								>
									Demo
								</span>
							)}
							<CaretDown aria-hidden="true" size={15} weight="bold" />
						</button>

						{openMenu === "neighborhood" && (
							<div
								aria-label="Neighborhood and account options"
								className={styles.menuPanel}
								id={`${menuId}-neighborhood`}
							>
								<p className={styles.menuEyebrow}>Your neighborhood</p>
								<p className={styles.menuTitle}>
									{user?.neighborhood.name ?? "Neighborhood"}
								</p>
								<Link
									className={styles.menuLink}
									onClick={closeFromMenuLink}
									to="/account#neighborhood"
								>
									Neighborhood settings
								</Link>
								<div aria-hidden="true" className={styles.menuDivider} />
								<button
									className={styles.menuButton}
									disabled={!onLogout || isLoggingOut}
									onClick={onLogout}
									type="button"
								>
									<SignOut aria-hidden="true" size={18} weight="bold" />
									{isLoggingOut ? "Signing out" : "Sign out"}
								</button>
							</div>
						)}
					</div>
				)}

				<nav
					aria-label={isApp ? "Member navigation" : "Primary navigation"}
					className={styles.primaryNav}
				>
					{isApp ? (
						<>
							<div className={styles.appDesktopNav}>
								<NavLink
									className={({ isActive }) => navLinkClassName(isActive)}
									end
									to="/feed"
								>
									<Newspaper aria-hidden="true" size={19} weight="duotone" />
									<span>Feed</span>
								</NavLink>
								{isCreateDisabled ? (
									<button
										aria-label="Create a listing is unavailable in the read-only demo"
										className={styles.navLink}
										disabled
										title="The demo account is read-only"
										type="button"
									>
										<PlusCircle aria-hidden="true" size={19} weight="duotone" />
										<span>Create</span>
									</button>
								) : (
									<NavLink
										className={({ isActive }) => navLinkClassName(isActive)}
										end
										to="/listings/new"
									>
										<PlusCircle aria-hidden="true" size={19} weight="duotone" />
										<span>Create</span>
									</NavLink>
								)}
								<NavLink
									className={({ isActive }) => navLinkClassName(isActive)}
									end
									to="/activity"
								>
									<Bell aria-hidden="true" size={19} weight="duotone" />
									<span>Activity</span>
								</NavLink>
								<NavLink
									className={({ isActive }) => navLinkClassName(isActive)}
									end
									to="/account"
								>
									<UserCircle aria-hidden="true" size={20} weight="duotone" />
									<span>Account</span>
								</NavLink>
							</div>
							<div className={styles.mobileTabs}>
								<NavLink
									className={({ isActive }) => navLinkClassName(isActive)}
									end
									to="/feed"
								>
									<Newspaper aria-hidden="true" size={21} weight="duotone" />
									<span>Feed</span>
								</NavLink>
								{isCreateDisabled ? (
									<button
										aria-label="Create a listing is unavailable in the read-only demo"
										className={styles.navLink}
										disabled
										title="The demo account is read-only"
										type="button"
									>
										<PlusCircle aria-hidden="true" size={21} weight="duotone" />
										<span>Create</span>
									</button>
								) : (
									<NavLink
										className={({ isActive }) => navLinkClassName(isActive)}
										end
										to="/listings/new"
									>
										<PlusCircle aria-hidden="true" size={21} weight="duotone" />
										<span>Create</span>
									</NavLink>
								)}
								<NavLink
									className={({ isActive }) => navLinkClassName(isActive)}
									end
									to="/activity"
								>
									<Bell aria-hidden="true" size={21} weight="duotone" />
									<span>Activity</span>
								</NavLink>
								<NavLink
									className={({ isActive }) => navLinkClassName(isActive)}
									end
									to="/account"
								>
									<UserCircle aria-hidden="true" size={22} weight="duotone" />
									<span>Account</span>
								</NavLink>
							</div>
						</>
					) : (
						<>
							<div className={styles.marketingDesktopNav}>
								<Link className={styles.navLink} to="/#how-it-works">
									How it works
								</Link>
								<Link className={styles.navLink} to="/#story">
									Our story
								</Link>
								<Link className={styles.navLink} to="/login">
									Sign in
								</Link>
								<Link className={styles.joinLink} to="/register">
									Join Neighborly
								</Link>
							</div>
							<div
								className={styles.menuRoot}
								onBlur={handleMenuBlur}
								onKeyDown={handleMenuKeyDown}
								ref={marketingMenuRef}
							>
								<button
									aria-controls={`${menuId}-marketing`}
									aria-expanded={openMenu === "marketing"}
									className={styles.marketingMenuTrigger}
									onClick={() =>
										setOpenMenu((current) =>
											current === "marketing" ? null : "marketing",
										)
									}
									ref={marketingToggleRef}
									type="button"
								>
									<List aria-hidden="true" size={20} weight="bold" />
									<span>Menu</span>
								</button>
								{openMenu === "marketing" && (
									<div
										aria-label="Primary navigation links"
										className={styles.menuPanel}
										id={`${menuId}-marketing`}
									>
										<Link
											className={styles.menuLink}
											onClick={closeFromMenuLink}
											to="/#how-it-works"
										>
											How it works
										</Link>
										<Link
											className={styles.menuLink}
											onClick={closeFromMenuLink}
											to="/#story"
										>
											Our story
										</Link>
										<Link
											className={styles.menuLink}
											onClick={closeFromMenuLink}
											to="/login"
										>
											Sign in
										</Link>
										<Link
											className={styles.menuLink}
											onClick={closeFromMenuLink}
											to="/register"
										>
											Join Neighborly
										</Link>
									</div>
								)}
							</div>
						</>
					)}
				</nav>
			</div>
		</header>
	);
}
