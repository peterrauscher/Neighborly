import {
	FloppyDisk,
	IdentificationCard,
	LockKey,
	MapPin,
	Sparkle,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
	Avatar,
	Badge,
	Button,
	InlineAlert,
	Select,
	Spinner,
	TextArea,
	TextField,
} from "../components/ui/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, apiRequest } from "../lib/api";
import {
	type NeighborhoodDto,
	PasswordChangeSchema,
	UserMePatchSchema,
} from "../lib/contracts";
function getFirstFieldError(
	fields: Record<string, unknown> | undefined,
	key: string,
): string | undefined {
	if (!fields) return undefined;
	const val = fields[key];
	if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
		return val[0];
	}
	return undefined;
}

import styles from "./AccountPage.module.css";

export function AccountPage() {
	const { state, user, updateProfile, changePassword, retrySession } =
		useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	// Neighborhood list
	const [neighborhoods, setNeighborhoods] = useState<NeighborhoodDto[]>([]);
	const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(true);

	// Profile Form State
	const [name, setName] = useState(user?.name || "");
	const [bio, setBio] = useState(user?.bio || "");
	const [neighborhoodId, setNeighborhoodId] = useState(
		user?.neighborhood?.id || "",
	);
	const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
	const [profileFieldErrors, setProfileFieldErrors] = useState<{
		name?: string;
		bio?: string;
		neighborhoodId?: string;
	}>({});
	const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
	const [profileError, setProfileError] = useState<string | null>(null);

	// Password Form State
	const [currentPassword, setCurrentPassword] = useState("");
	const [nextPassword, setNextPassword] = useState("");
	const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
	const [passwordFieldErrors, setPasswordFieldErrors] = useState<{
		currentPassword?: string;
		nextPassword?: string;
	}>({});
	const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
	const [passwordError, setPasswordError] = useState<string | null>(null);

	// Screen reader announcements
	const [announcement, setAnnouncement] = useState<string>("");

	// Element refs for focus-on-error
	const nameRef = useRef<HTMLInputElement>(null);
	const bioRef = useRef<HTMLTextAreaElement>(null);
	const neighborhoodRef = useRef<HTMLSelectElement>(null);
	const currentPasswordRef = useRef<HTMLInputElement>(null);
	const nextPasswordRef = useRef<HTMLInputElement>(null);
	const profileAlertRef = useRef<HTMLDivElement>(null);
	const passwordAlertRef = useRef<HTMLDivElement>(null);

	// Unauthenticated check
	useEffect(() => {
		if (state.status === "anonymous" || (!user && state.status !== "loading")) {
			const currentPath = `${location.pathname}${location.search}${location.hash}`;
			navigate(`/login?redirect=${encodeURIComponent(currentPath)}`, {
				replace: true,
			});
		}
	}, [state.status, user, location, navigate]);

	// Sync local fields if user object changes
	useEffect(() => {
		if (user) {
			setName(user.name);
			setBio(user.bio ?? "");
			setNeighborhoodId(user.neighborhood?.id || "");
		}
	}, [user]);

	// Load neighborhoods for selector
	useEffect(() => {
		let isMounted = true;
		async function loadNeighborhoods() {
			try {
				const res = await apiRequest("neighborhoods", {});
				if (isMounted) {
					setNeighborhoods(res.data || []);
				}
			} catch {
				// Silently fallback if neighborhood loading fails
			} finally {
				if (isMounted) {
					setIsLoadingNeighborhoods(false);
				}
			}
		}
		void loadNeighborhoods();
		return () => {
			isMounted = false;
		};
	}, []);

	// Handle Profile Update (Consolidated mePatch)
	const handleProfileSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setProfileSuccess(null);
		setProfileError(null);
		setAnnouncement("");

		if (user?.isDemo) {
			const demoMsg =
				"Profile changes are disabled for the read-only demo account and are not saved.";
			setProfileError(demoMsg);
			setAnnouncement(demoMsg);
			return;
		}

		const currentBio = user?.bio ?? "";
		const trimmedBio = bio.trim();
		const trimmedName = name.trim();

		// Build consolidated patch object
		const mePatch: Record<string, string> = {};
		if (trimmedName && trimmedName !== user?.name) mePatch.name = trimmedName;
		if (trimmedBio !== currentBio) mePatch.bio = trimmedBio;
		if (neighborhoodId && neighborhoodId !== user?.neighborhood?.id)
			mePatch.neighborhoodId = neighborhoodId;

		if (Object.keys(mePatch).length === 0) {
			setProfileSuccess("No profile changes detected.");
			return;
		}

		// Validate consolidated patch with UserMePatchSchema
		const validation = UserMePatchSchema.safeParse(mePatch);
		if (!validation.success) {
			const errors: { name?: string; bio?: string; neighborhoodId?: string } =
				{};
			for (const issue of validation.error.issues) {
				const field = issue.path[0] as "name" | "bio" | "neighborhoodId";
				if (field && !errors[field]) {
					errors[field] = issue.message;
				}
			}
			setProfileFieldErrors(errors);
			const firstKey =
				(Object.keys(errors)[0] as keyof typeof errors) || "name";
			const msg = `Profile validation error: ${errors[firstKey]}`;
			setAnnouncement(msg);

			if (errors.name) nameRef.current?.focus();
			else if (errors.bio) bioRef.current?.focus();
			else if (errors.neighborhoodId) neighborhoodRef.current?.focus();
			return;
		}

		setProfileFieldErrors({});
		setIsProfileSubmitting(true);

		try {
			// Single consolidated updateProfile call
			await updateProfile(mePatch);
			const msg = "Profile settings saved successfully.";
			setProfileSuccess(msg);
			setAnnouncement(msg);
		} catch (err) {
			if (err instanceof ApiError) {
				const nameErr = getFirstFieldError(err.fields, "name");
				const bioErr = getFirstFieldError(err.fields, "bio");
				const neighborhoodIdErr = getFirstFieldError(
					err.fields,
					"neighborhoodId",
				);
				const formErr = getFirstFieldError(err.fields, "_form");

				const fieldErrs: {
					name?: string;
					bio?: string;
					neighborhoodId?: string;
				} = {};
				if (nameErr) fieldErrs.name = nameErr;
				if (bioErr) fieldErrs.bio = bioErr;
				if (neighborhoodIdErr) fieldErrs.neighborhoodId = neighborhoodIdErr;

				setProfileFieldErrors(fieldErrs);
				const topMsg = formErr || err.message || "Failed to update profile.";
				setProfileError(topMsg);
				setAnnouncement(topMsg);
				if (fieldErrs.name) nameRef.current?.focus();
				else if (fieldErrs.bio) bioRef.current?.focus();
				else if (fieldErrs.neighborhoodId) neighborhoodRef.current?.focus();
				else profileAlertRef.current?.focus();
			} else {
				const genericMsg =
					"An unexpected error occurred while updating profile.";
				setProfileError(genericMsg);
				setAnnouncement(genericMsg);
			}
		} finally {
			setIsProfileSubmitting(false);
		}
	};

	// Handle Password Change
	const handlePasswordSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setPasswordSuccess(null);
		setPasswordError(null);
		setAnnouncement("");

		if (user?.isDemo) {
			const demoMsg =
				"Password changes are disabled for the read-only demo account.";
			setPasswordError(demoMsg);
			setAnnouncement(demoMsg);
			return;
		}

		// Client validation using PasswordChangeSchema
		const validation = PasswordChangeSchema.safeParse({
			currentPassword,
			nextPassword,
		});

		if (!validation.success) {
			const errors: { currentPassword?: string; nextPassword?: string } = {};
			for (const issue of validation.error.issues) {
				const field = issue.path[0] as "currentPassword" | "nextPassword";
				if (field && !errors[field]) {
					errors[field] = issue.message;
				}
			}
			setPasswordFieldErrors(errors);
			const firstKey =
				(Object.keys(errors)[0] as keyof typeof errors) || "currentPassword";
			const msg = `Password error: ${errors[firstKey]}`;
			setAnnouncement(msg);

			if (errors.currentPassword) currentPasswordRef.current?.focus();
			else if (errors.nextPassword) nextPasswordRef.current?.focus();
			return;
		}

		setPasswordFieldErrors({});
		setIsPasswordSubmitting(true);

		try {
			await changePassword({ currentPassword, nextPassword });
			// Navigate to login with reason=password_changed
			navigate("/login?reason=password_changed");
		} catch (err) {
			if (err instanceof ApiError) {
				const currentPasswordErr = getFirstFieldError(
					err.fields,
					"currentPassword",
				);
				const nextPasswordErr = getFirstFieldError(err.fields, "nextPassword");
				const formErr = getFirstFieldError(err.fields, "_form");

				const fieldErrs: { currentPassword?: string; nextPassword?: string } =
					{};
				if (currentPasswordErr) fieldErrs.currentPassword = currentPasswordErr;
				if (nextPasswordErr) fieldErrs.nextPassword = nextPasswordErr;

				setPasswordFieldErrors(fieldErrs);
				const topMsg = formErr || err.message || "Failed to change password.";
				setPasswordError(topMsg);
				setAnnouncement(topMsg);
				if (fieldErrs.currentPassword) currentPasswordRef.current?.focus();
				else if (fieldErrs.nextPassword) nextPasswordRef.current?.focus();
				else passwordAlertRef.current?.focus();
			} else {
				const genericMsg =
					"An unexpected error occurred while changing password.";
				setPasswordError(genericMsg);
				setAnnouncement(genericMsg);
			}
		} finally {
			setIsPasswordSubmitting(false);
		}
	};

	const neighborhoodOptions = neighborhoods.map((n) => ({
		value: n.id,
		label: `${n.name} — ${n.city}, ${n.state}`,
	}));

	if (state.status === "loading" || !user) {
		return (
			<div className={styles.container}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "var(--space-3)",
						padding: "var(--space-12)",
					}}
				>
					<Spinner size="lg" />
					<span>Loading account details...</span>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			{/* Screen reader live announcements */}
			<div className={styles.srAnnounce} aria-live="polite" aria-atomic="true">
				{announcement}
			</div>

			{/* Session Error / Offline Banner */}
			{state.status === "offline" && (
				<InlineAlert
					variant="warning"
					title="Connection Offline"
					action={
						<Button
							size="sm"
							variant="outline"
							onClick={() => void retrySession()}
						>
							Retry Connection
						</Button>
					}
				>
					You are currently offline. Profile updates are unavailable until your
					connection is restored.
				</InlineAlert>
			)}

			{state.status === "error" && (
				<InlineAlert
					variant="error"
					title="Session Recovery Error"
					action={
						<Button
							size="sm"
							variant="outline"
							onClick={() => void retrySession()}
						>
							Retry Session
						</Button>
					}
				>
					{state.error.message}
				</InlineAlert>
			)}

			{/* Demo Account Read-Only Banner */}
			{user.isDemo && (
				<InlineAlert variant="info" title="Read-Only Demo Account">
					You are using a read-only demo account. Profile and password changes
					are disabled and are not saved.
				</InlineAlert>
			)}

			{/* Header Overview Card */}
			<header className={styles.headerCard}>
				<div className={styles.profileMeta}>
					<Avatar
						name={user.name}
						src={user.avatarPath || undefined}
						size="xl"
					/>
					<div className={styles.metaText}>
						<h1 className={styles.userName}>{user.name}</h1>
						<div className={styles.userSub}>
							<span>@{user.handle}</span>
							<span>&bull;</span>
							<span>{user.email}</span>
						</div>
						<div className={styles.badgeRow}>
							{user.isDemo ? (
								<Badge variant="warning" icon={<Sparkle size={12} />}>
									Demo Account
								</Badge>
							) : (
								<Badge variant="primary">Account</Badge>
							)}
							{user.neighborhood && (
								<Badge variant="default" icon={<MapPin size={12} />}>
									{user.neighborhood.name} ({user.neighborhood.city})
								</Badge>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Main Settings Sections */}
			<main
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-8)",
				}}
			>
				{/* Section 1: Profile Information */}
				<section
					className={styles.sectionCard}
					aria-labelledby="profile-settings-title"
				>
					<div className={styles.sectionHeader}>
						<h2 id="profile-settings-title" className={styles.sectionTitle}>
							Profile Settings
						</h2>
						<p className={styles.sectionSubtitle}>
							Manage your public display name, bio, and primary neighborhood
							circle.
						</p>
					</div>

					{profileSuccess && (
						<InlineAlert
							variant="success"
							title="Profile Updated"
							onClose={() => setProfileSuccess(null)}
						>
							{profileSuccess}
						</InlineAlert>
					)}

					{profileError && (
						<div
							ref={profileAlertRef}
							tabIndex={-1}
							style={{ outline: "none" }}
						>
							<InlineAlert
								variant="error"
								title="Profile Update Error"
								onClose={() => setProfileError(null)}
							>
								{profileError}
							</InlineAlert>
						</div>
					)}

					<form
						className={styles.form}
						onSubmit={handleProfileSubmit}
						noValidate
					>
						<TextField
							ref={nameRef}
							id="account-name"
							label="Full Name"
							type="text"
							autoComplete="name"
							required
							value={name}
							onChange={(e) => setName(e.target.value)}
							error={profileFieldErrors.name}
							disabled={
								user.isDemo || isProfileSubmitting || state.status === "offline"
							}
						/>

						<TextField
							id="account-handle"
							label="Handle"
							type="text"
							disabled
							value={`@${user.handle}`}
							helpText="Handles are unique community tokens and cannot be modified."
							leftIcon={<IdentificationCard size={18} />}
						/>

						<TextArea
							ref={bioRef}
							id="account-bio"
							label="Bio / Introduction"
							rows={4}
							maxLength={500}
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							error={profileFieldErrors.bio}
							disabled={
								user.isDemo || isProfileSubmitting || state.status === "offline"
							}
							helpText={`${bio.length}/500 characters &bull; Tell local neighbors what tools or skills you can share.`}
						/>

						<Select
							ref={neighborhoodRef}
							id="account-neighborhood"
							label="Primary Neighborhood Circle"
							value={neighborhoodId}
							onChange={(e) => setNeighborhoodId(e.target.value)}
							options={neighborhoodOptions}
							error={profileFieldErrors.neighborhoodId}
							disabled={
								user.isDemo ||
								isLoadingNeighborhoods ||
								isProfileSubmitting ||
								state.status === "offline"
							}
							helpText="Your selected circle filters your local mutual aid feed."
						/>

						<div>
							<Button
								type="submit"
								variant="primary"
								size="md"
								isLoading={isProfileSubmitting}
								disabled={
									user.isDemo ||
									isProfileSubmitting ||
									state.status === "offline"
								}
								leftIcon={<FloppyDisk size={18} />}
							>
								Save Profile Changes
							</Button>
						</div>
					</form>
				</section>

				{/* Section 2: Authenticated Password Change */}
				<section
					className={styles.sectionCard}
					aria-labelledby="password-settings-title"
				>
					<div className={styles.sectionHeader}>
						<h2 id="password-settings-title" className={styles.sectionTitle}>
							Security &amp; Password
						</h2>
						<p className={styles.sectionSubtitle}>
							Update your password to keep your account secure.
						</p>
					</div>

					<div className={styles.reloginNotice}>
						<strong>Session Notice:</strong> Changing your password will
						invalidate active sessions on other devices. You will be required to
						sign in again with your new credentials on those devices.
					</div>

					{passwordSuccess && (
						<InlineAlert
							variant="success"
							title="Password Changed"
							onClose={() => setPasswordSuccess(null)}
						>
							{passwordSuccess}
						</InlineAlert>
					)}

					{passwordError && (
						<div
							ref={passwordAlertRef}
							tabIndex={-1}
							style={{ outline: "none" }}
						>
							<InlineAlert
								variant="error"
								title="Password Change Error"
								onClose={() => setPasswordError(null)}
							>
								{passwordError}
							</InlineAlert>
						</div>
					)}

					<form
						className={styles.form}
						onSubmit={handlePasswordSubmit}
						noValidate
					>
						<TextField
							ref={currentPasswordRef}
							id="account-current-password"
							label="Current Password"
							type="password"
							autoComplete="current-password"
							required
							placeholder="Enter current password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							error={passwordFieldErrors.currentPassword}
							disabled={
								isPasswordSubmitting ||
								user.isDemo ||
								state.status === "offline"
							}
						/>

						<TextField
							ref={nextPasswordRef}
							id="account-next-password"
							label="New Password"
							type="password"
							autoComplete="new-password"
							required
							placeholder="Enter new strong password"
							helpText="Must differ from current password and contain uppercase, lowercase, and numbers (min 8 chars)"
							value={nextPassword}
							onChange={(e) => setNextPassword(e.target.value)}
							error={passwordFieldErrors.nextPassword}
							disabled={
								isPasswordSubmitting ||
								user.isDemo ||
								state.status === "offline"
							}
						/>

						<div>
							<Button
								type="submit"
								variant="primary"
								size="md"
								isLoading={isPasswordSubmitting}
								disabled={
									isPasswordSubmitting ||
									user.isDemo ||
									state.status === "offline"
								}
								leftIcon={<LockKey size={18} />}
							>
								Update Password
							</Button>
						</div>
					</form>
				</section>
			</main>
		</div>
	);
}

export default AccountPage;
