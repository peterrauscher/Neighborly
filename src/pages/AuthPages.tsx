import {
	ArrowRight,
	CheckCircle,
	ShieldCheck,
	Sparkle,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
	Button,
	InlineAlert,
	Select,
	TextField,
} from "../components/ui/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, apiRequest, safeRedirectTarget } from "../lib/api";
import {
	AuthLoginInputSchema,
	AuthRegisterInputSchema,
	type NeighborhoodDto,
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
import styles from "./AuthPages.module.css";

/* ==========================================================================
   LOGIN PAGE
   ========================================================================== */

export function LoginPage() {
	const { login, loginDemo } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);

	const [fieldErrors, setFieldErrors] = useState<{
		email?: string;
		password?: string;
	}>({});
	const [serverError, setServerError] = useState<string | null>(null);

	const searchParams = new URLSearchParams(location.search);
	const isPasswordChanged = searchParams.get("reason") === "password_changed";

	const [announcement, setAnnouncement] = useState<string>(
		isPasswordChanged
			? "Password changed successfully. Please sign in with your new credentials."
			: "",
	);

	const emailRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const errorAlertRef = useRef<HTMLDivElement>(null);

	const redirectTarget = safeRedirectTarget(location.search, "/feed");

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setServerError(null);
		setAnnouncement("");

		// Zod client validation
		const validationResult = AuthLoginInputSchema.safeParse({
			email,
			password,
		});
		if (!validationResult.success) {
			const errors: { email?: string; password?: string } = {};
			for (const issue of validationResult.error.issues) {
				const field = issue.path[0] as "email" | "password";
				if (field && !errors[field]) {
					errors[field] = issue.message;
				}
			}
			setFieldErrors(errors);
			const firstField = errors.email ? "email" : "password";
			const msg = `Validation failed: ${errors[firstField]}`;
			setAnnouncement(msg);

			if (errors.email) {
				emailRef.current?.focus();
			} else if (errors.password) {
				passwordRef.current?.focus();
			}
			return;
		}

		setFieldErrors({});
		setIsSubmitting(true);

		try {
			const user = await login({ email, password });
			if (user) {
				navigate(redirectTarget);
			}
		} catch (err) {
			if (err instanceof ApiError) {
				const emailErr = getFirstFieldError(err.fields, "email");
				const passwordErr = getFirstFieldError(err.fields, "password");
				const formErr = getFirstFieldError(err.fields, "_form");

				const nextFieldErrors: { email?: string; password?: string } = {};
				if (emailErr) nextFieldErrors.email = emailErr;
				if (passwordErr) nextFieldErrors.password = passwordErr;

				setFieldErrors(nextFieldErrors);

				const topMessage = formErr || err.message || "Failed to sign in.";
				setAnnouncement(topMessage);

				if (nextFieldErrors.email) {
					emailRef.current?.focus();
				} else if (nextFieldErrors.password) {
					passwordRef.current?.focus();
				} else {
					errorAlertRef.current?.focus();
				}
			} else {
				const genericMsg = "An unexpected error occurred during sign in.";
				setServerError(genericMsg);
				setAnnouncement(genericMsg);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDemoLogin = async () => {
		setServerError(null);
		setAnnouncement("");
		setIsDemoSubmitting(true);
		try {
			const user = await loginDemo();
			if (user) {
				navigate(redirectTarget);
			}
		} catch (err) {
			const msg =
				err instanceof ApiError ? err.message : "Demo sign in failed.";
			setServerError(msg);
			setAnnouncement(msg);
		} finally {
			setIsDemoSubmitting(false);
		}
	};

	return (
		<div className={styles.pageContainer}>
			{/* Screen reader live announcements */}
			<div className={styles.srAnnounce} aria-live="polite" aria-atomic="true">
				{announcement}
			</div>

			<div className={styles.editorialGrid}>
				{/* Civic Editorial Panel */}
				<section
					className={styles.civicHero}
					aria-labelledby="login-hero-heading"
				>
					<div className={styles.heroContent}>
						<div className={styles.badgeRow}>
							<span className={styles.awardBadge}>
								<Sparkle size={14} weight="fill" />
								2025 Civic Technology Design Winner
							</span>
						</div>
						<h2 id="login-hero-heading" className={styles.heroTitle}>
							Local trust, verified neighbor exchanges.
						</h2>
						<p className={styles.heroBody}>
							Neighborly powers hyper-local tool sharing, skill exchanges, and
							mutual aid without advertising or commercial algorithms.
						</p>
						<ul className={styles.trustList}>
							<li className={styles.trustItem}>
								<ShieldCheck size={20} className={styles.trustIcon} />
								<span>
									<strong>Zero ad tracking:</strong> Your personal data is never
									monetized.
								</span>
							</li>
							<li className={styles.trustItem}>
								<CheckCircle size={20} className={styles.trustIcon} />
								<span>
									<strong>Verified circles:</strong> Mutual trust boundaries
									protect every exchange.
								</span>
							</li>
						</ul>
					</div>

					<div className={styles.heroQuote}>
						<p className={styles.quoteText}>
							&ldquo;Neighborly helped our block share lawn care equipment and
							building supplies effortlessly during our community garden
							project.&rdquo;
						</p>
						<p className={styles.quoteAuthor}>
							&mdash; Maplewood Community Council
						</p>
					</div>
				</section>

				{/* Sign In Form Panel */}
				<main className={styles.formCard} aria-labelledby="login-form-title">
					<header className={styles.formHeader}>
						<h1 id="login-form-title" className={styles.formTitle}>
							Sign in to your circle
						</h1>
						<p className={styles.formSubtitle}>
							Need an account?{" "}
							<Link
								to={`/register${location.search}`}
								className={styles.navLink}
							>
								Join your neighborhood
							</Link>
						</p>
					</header>

					{isPasswordChanged && (
						<div style={{ marginBottom: "var(--space-4)" }}>
							<InlineAlert
								variant="success"
								title="Password Changed Successfully"
							>
								Your password was updated. Please sign in with your new
								credentials.
							</InlineAlert>
						</div>
					)}

					{serverError && (
						<div
							ref={errorAlertRef}
							tabIndex={-1}
							style={{ outline: "none", marginBottom: "var(--space-4)" }}
						>
							<InlineAlert
								variant="error"
								title="Sign In Error"
								onClose={() => setServerError(null)}
							>
								{serverError}
							</InlineAlert>
						</div>
					)}

					<form className={styles.form} onSubmit={handleSubmit} noValidate>
						<TextField
							ref={emailRef}
							id="login-email"
							label="Email Address"
							type="email"
							autoComplete="email"
							required
							placeholder="you@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							error={fieldErrors.email}
							disabled={isSubmitting || isDemoSubmitting}
						/>

						<TextField
							ref={passwordRef}
							id="login-password"
							label="Password"
							type="password"
							autoComplete="current-password"
							required
							placeholder="Enter your password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							error={fieldErrors.password}
							disabled={isSubmitting || isDemoSubmitting}
						/>

						<Button
							type="submit"
							variant="primary"
							size="lg"
							fullWidth
							isLoading={isSubmitting}
							disabled={isSubmitting || isDemoSubmitting}
							rightIcon={<ArrowRight size={18} />}
						>
							Sign In
						</Button>
					</form>

					<div className={styles.demoSection}>
						<div className={styles.demoDividerText}>
							Or Explore Without Account
						</div>
						<Button
							type="button"
							variant="outline"
							size="md"
							fullWidth
							isLoading={isDemoSubmitting}
							disabled={isSubmitting || isDemoSubmitting}
							onClick={handleDemoLogin}
						>
							Try Demo Account (Read-Only)
						</Button>
					</div>
				</main>
			</div>
		</div>
	);
}

/* ==========================================================================
   REGISTER PAGE
   ========================================================================== */

export function RegisterPage() {
	const { register, loginDemo } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [neighborhoodId, setNeighborhoodId] = useState("");

	const [neighborhoods, setNeighborhoods] = useState<NeighborhoodDto[]>([]);
	const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(true);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);

	const [fieldErrors, setFieldErrors] = useState<{
		name?: string;
		email?: string;
		password?: string;
		neighborhoodId?: string;
	}>({});
	const [serverError, setServerError] = useState<string | null>(null);
	const [announcement, setAnnouncement] = useState<string>("");

	const nameRef = useRef<HTMLInputElement>(null);
	const emailRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const neighborhoodRef = useRef<HTMLSelectElement>(null);
	const errorAlertRef = useRef<HTMLDivElement>(null);

	// Always enter /onboarding, carrying intended post-onboarding target as encoded redirect
	const intendedTarget = safeRedirectTarget(location.search, "/feed");
	const onboardingTarget = `/onboarding?redirect=${encodeURIComponent(intendedTarget)}`;

	// Load available neighborhoods for registration select
	useEffect(() => {
		let isMounted = true;
		async function loadNeighborhoods() {
			try {
				const response = await apiRequest("neighborhoods", {});
				if (isMounted) {
					const list = response.data || [];
					setNeighborhoods(list);
					if (list.length > 0) {
						setNeighborhoodId((current) => current || list[0].id);
					}
				}
			} catch {
				if (isMounted) {
					setServerError("Failed to load available neighborhood list.");
				}
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

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setServerError(null);
		setAnnouncement("");

		// Zod client validation
		const validationResult = AuthRegisterInputSchema.safeParse({
			name,
			email,
			password,
			neighborhoodId,
		});

		if (!validationResult.success) {
			const errors: {
				name?: string;
				email?: string;
				password?: string;
				neighborhoodId?: string;
			} = {};

			for (const issue of validationResult.error.issues) {
				const field = issue.path[0] as
					| "name"
					| "email"
					| "password"
					| "neighborhoodId";
				if (field && !errors[field]) {
					errors[field] = issue.message;
				}
			}

			setFieldErrors(errors);
			const firstKey =
				(Object.keys(errors)[0] as keyof typeof errors) || "name";
			const msg = `Validation failed: ${errors[firstKey]}`;
			setAnnouncement(msg);

			if (errors.name) nameRef.current?.focus();
			else if (errors.email) emailRef.current?.focus();
			else if (errors.password) passwordRef.current?.focus();
			else if (errors.neighborhoodId) neighborhoodRef.current?.focus();
			return;
		}

		setFieldErrors({});
		setIsSubmitting(true);

		try {
			const user = await register({
				name,
				email,
				password,
				neighborhoodId,
			});
			if (user) {
				navigate(onboardingTarget);
			}
		} catch (err) {
			if (err instanceof ApiError) {
				const nameErr = getFirstFieldError(err.fields, "name");
				const emailErr = getFirstFieldError(err.fields, "email");
				const passwordErr = getFirstFieldError(err.fields, "password");
				const neighborhoodIdErr = getFirstFieldError(
					err.fields,
					"neighborhoodId",
				);
				const formErr = getFirstFieldError(err.fields, "_form");

				const nextFieldErrors: {
					name?: string;
					email?: string;
					password?: string;
					neighborhoodId?: string;
				} = {};
				if (nameErr) nextFieldErrors.name = nameErr;
				if (emailErr) nextFieldErrors.email = emailErr;
				if (passwordErr) nextFieldErrors.password = passwordErr;
				if (neighborhoodIdErr)
					nextFieldErrors.neighborhoodId = neighborhoodIdErr;

				setFieldErrors(nextFieldErrors);

				const topMessage =
					formErr || err.message || "Failed to create account.";

				if (nextFieldErrors.name) nameRef.current?.focus();
				else if (nextFieldErrors.email) emailRef.current?.focus();
				else if (nextFieldErrors.password) passwordRef.current?.focus();
				else if (nextFieldErrors.neighborhoodId)
					neighborhoodRef.current?.focus();
				else errorAlertRef.current?.focus();
			} else {
				const genericMsg = "An unexpected error occurred during registration.";
				setServerError(genericMsg);
				setAnnouncement(genericMsg);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDemoLogin = async () => {
		setServerError(null);
		setAnnouncement("");
		setIsDemoSubmitting(true);
		try {
			const user = await loginDemo();
			if (user) {
				navigate(onboardingTarget);
			}
		} catch (err) {
			const msg =
				err instanceof ApiError ? err.message : "Demo sign in failed.";
			setServerError(msg);
			setAnnouncement(msg);
		} finally {
			setIsDemoSubmitting(false);
		}
	};

	const neighborhoodOptions = neighborhoods.map((n) => ({
		value: n.id,
		label: `${n.name} — ${n.city}, ${n.state}`,
	}));

	return (
		<div className={styles.pageContainer}>
			<div className={styles.srAnnounce} aria-live="polite" aria-atomic="true">
				{announcement}
			</div>

			<div className={styles.editorialGrid}>
				{/* Civic Narrative Panel */}
				<section
					className={styles.civicHero}
					aria-labelledby="register-hero-heading"
				>
					<div className={styles.heroContent}>
						<div className={styles.badgeRow}>
							<span className={styles.awardBadge}>
								<ShieldCheck size={14} weight="fill" />
								Verified Local Network
							</span>
						</div>
						<h2 id="register-hero-heading" className={styles.heroTitle}>
							Join your neighborhood circle.
						</h2>
						<p className={styles.heroBody}>
							Exchange tools, borrow equipment, and help local neighbors in a
							safe, verified civic space.
						</p>
						<ul className={styles.trustList}>
							<li className={styles.trustItem}>
								<CheckCircle size={20} className={styles.trustIcon} />
								<span>
									<strong>Privacy Guarantee:</strong> Precise street addresses
									and house numbers are never stored or displayed.
								</span>
							</li>
							<li className={styles.trustItem}>
								<CheckCircle size={20} className={styles.trustIcon} />
								<span>
									<strong>Community Circle:</strong> Local exchanges stay within
									your neighborhood walking/driving radius.
								</span>
							</li>
						</ul>
					</div>

					<div className={styles.heroQuote}>
						<p className={styles.quoteText}>
							&ldquo;Knowing who lives on my block and being able to share
							resources has transformed our neighborhood connection.&rdquo;
						</p>
						<p className={styles.quoteAuthor}>
							&mdash; Resident, Oakwood Circle
						</p>
					</div>
				</section>

				{/* Registration Form Panel */}
				<main className={styles.formCard} aria-labelledby="register-form-title">
					<header className={styles.formHeader}>
						<h1 id="register-form-title" className={styles.formTitle}>
							Create your account
						</h1>
						<p className={styles.formSubtitle}>
							Already registered?{" "}
							<Link to={`/login${location.search}`} className={styles.navLink}>
								Sign in here
							</Link>
						</p>
					</header>

					{serverError && (
						<div
							ref={errorAlertRef}
							tabIndex={-1}
							style={{ outline: "none", marginBottom: "var(--space-4)" }}
						>
							<InlineAlert
								variant="error"
								title="Registration Error"
								onClose={() => setServerError(null)}
							>
								{serverError}
							</InlineAlert>
						</div>
					)}

					<form className={styles.form} onSubmit={handleSubmit} noValidate>
						<TextField
							ref={nameRef}
							id="register-name"
							label="Full Name"
							type="text"
							autoComplete="name"
							required
							placeholder="Jane Doe"
							value={name}
							onChange={(e) => setName(e.target.value)}
							error={fieldErrors.name}
							disabled={isSubmitting || isDemoSubmitting}
						/>

						<TextField
							ref={emailRef}
							id="register-email"
							label="Email Address"
							type="email"
							autoComplete="email"
							required
							placeholder="you@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							error={fieldErrors.email}
							disabled={isSubmitting || isDemoSubmitting}
						/>

						<TextField
							ref={passwordRef}
							id="register-password"
							label="Password"
							type="password"
							autoComplete="new-password"
							required
							helpText="Must contain uppercase, lowercase, and numbers (min 8 chars)"
							placeholder="Create a strong password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							error={fieldErrors.password}
							disabled={isSubmitting || isDemoSubmitting}
						/>

						<div>
							<Select
								ref={neighborhoodRef}
								id="register-neighborhood"
								label="Select Neighborhood Circle"
								required
								value={neighborhoodId}
								onChange={(e) => setNeighborhoodId(e.target.value)}
								options={neighborhoodOptions}
								error={fieldErrors.neighborhoodId}
								disabled={
									isLoadingNeighborhoods || isSubmitting || isDemoSubmitting
								}
								helpText={
									isLoadingNeighborhoods
										? "Loading available circles..."
										: undefined
								}
							/>
							<p className={styles.privacyNote}>
								Your address is never publicly shared. Neighborhoods only define
								your local exchange radius.
							</p>
						</div>

						<Button
							type="submit"
							variant="primary"
							size="lg"
							fullWidth
							isLoading={isSubmitting}
							disabled={
								isSubmitting || isDemoSubmitting || isLoadingNeighborhoods
							}
							rightIcon={<ArrowRight size={18} />}
						>
							Register Account
						</Button>
					</form>

					<div className={styles.demoSection}>
						<div className={styles.demoDividerText}>
							Or Explore Without Account
						</div>
						<Button
							type="button"
							variant="outline"
							size="md"
							fullWidth
							isLoading={isDemoSubmitting}
							disabled={isSubmitting || isDemoSubmitting}
							onClick={handleDemoLogin}
						>
							Try Demo Account (Read-Only)
						</Button>
					</div>
				</main>
			</div>
		</div>
	);
}

export default LoginPage;
