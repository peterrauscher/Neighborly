import {
	ArrowRight,
	CheckCircle,
	House,
	MapPin,
	ShieldCheck,
	Sparkle,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
	Badge,
	Button,
	InlineAlert,
	Spinner,
} from "../components/ui/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, apiRequest, safeRedirectTarget } from "../lib/api";
import type { NeighborhoodDto } from "../lib/contracts";

export function OnboardingPage() {
	const { state, user, changeNeighborhood } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();

	const [neighborhoods, setNeighborhoods] = useState<NeighborhoodDto[]>([]);
	const [selectedId, setSelectedId] = useState<string>(
		user?.neighborhood?.id || "",
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [announcement, setAnnouncement] = useState<string>("");

	const alertRef = useRef<HTMLDivElement>(null);

	const redirectTarget = safeRedirectTarget(location.search, "/feed");

	// Unauthenticated check
	useEffect(() => {
		if (state.status === "anonymous" || (!user && state.status !== "loading")) {
			const currentPath = `${location.pathname}${location.search}${location.hash}`;
			navigate(`/login?redirect=${encodeURIComponent(currentPath)}`, {
				replace: true,
			});
		}
	}, [state.status, user, location, navigate]);

	useEffect(() => {
		let isMounted = true;
		async function fetchNeighborhoods() {
			try {
				const response = await apiRequest("neighborhoods", {});
				if (isMounted) {
					const list = response.data || [];
					setNeighborhoods(list);
					if (list.length > 0) {
						const preferredId = user?.neighborhood?.id;
						setSelectedId((current) => current || preferredId || list[0].id);
					}
				}
			} catch (err) {
				if (isMounted) {
					const msg =
						err instanceof ApiError
							? err.message
							: "Failed to load neighborhood list.";
					setError(msg);
					setAnnouncement(msg);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}
		void fetchNeighborhoods();
		return () => {
			isMounted = false;
		};
	}, [user?.neighborhood?.id]);

	const handleConfirm = async () => {
		if (!selectedId) {
			setError("Please select a neighborhood circle.");
			setAnnouncement("Please select a neighborhood circle.");
			return;
		}

		setError(null);
		setIsSubmitting(true);
		setAnnouncement("Updating your neighborhood circle...");

		try {
			await changeNeighborhood(selectedId);
			setAnnouncement("Neighborhood circle confirmed. Redirecting...");
			navigate(redirectTarget);
		} catch (err) {
			const msg =
				err instanceof ApiError
					? err.message
					: "Failed to update neighborhood.";
			setError(msg);
			setAnnouncement(msg);
			alertRef.current?.focus();
		} finally {
			setIsSubmitting(false);
		}
	};

	const currentNeighborhood = neighborhoods.find((n) => n.id === selectedId);

	if (state.status === "loading") {
		return (
			<div
				style={{
					minHeight: "100vh",
					backgroundColor: "var(--color-bg-base)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: "var(--space-3)",
					padding: "var(--space-8)",
				}}
			>
				<Spinner size="lg" />
				<span>Loading onboarding session...</span>
			</div>
		);
	}

	return (
		<div
			style={{
				minHeight: "100vh",
				backgroundColor: "var(--color-bg-base)",
				display: "flex",
				justifyContent: "center",
				padding: "var(--space-8) var(--space-4)",
			}}
		>
			<div
				aria-live="polite"
				aria-atomic="true"
				style={{
					position: "absolute",
					width: "1px",
					height: "1px",
					overflow: "hidden",
					clip: "rect(0,0,0,0)",
				}}
			>
				{announcement}
			</div>

			<main
				style={{
					maxWidth: "800px",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					gap: "var(--space-6)",
				}}
			>
				{/* Header */}
				<header
					style={{
						backgroundColor: "var(--color-bg-surface)",
						border: "1px solid var(--color-border)",
						borderRadius: "var(--radius-lg)",
						padding: "var(--space-8)",
						boxShadow: "var(--shadow-sm)",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "var(--space-2)",
							marginBottom: "var(--space-3)",
						}}
					>
						<Badge variant="primary" icon={<Sparkle size={14} />}>
							Step 1 of 1 &bull; Circle Verification
						</Badge>
					</div>

					<h1
						style={{
							fontSize: "var(--text-3xl)",
							fontWeight: "var(--font-weight-bold)",
							color: "var(--color-ink-primary)",
							margin: "0 0 var(--space-2) 0",
						}}
					>
						Welcome to your local circle
					</h1>
					<p
						style={{
							fontSize: "var(--text-base)",
							color: "var(--color-ink-secondary)",
							lineHeight: "var(--leading-relaxed)",
							margin: 0,
						}}
					>
						Neighborly exchanges are rooted in local community trust. Choose
						your primary neighborhood to connect with nearby tool sharing and
						mutual aid requests.
					</p>
				</header>

				{/* Privacy Callout */}
				<div
					style={{
						backgroundColor: "var(--color-forest-subtle)",
						border: "1px solid var(--color-border-subtle)",
						borderRadius: "var(--radius-md)",
						padding: "var(--space-4) var(--space-6)",
						display: "flex",
						alignItems: "flex-start",
						gap: "var(--space-4)",
					}}
				>
					<ShieldCheck
						size={24}
						style={{
							color: "var(--color-forest)",
							flexShrink: 0,
							marginTop: "2px",
						}}
					/>
					<div>
						<h2
							style={{
								fontSize: "var(--text-sm)",
								fontWeight: "var(--font-weight-semibold)",
								color: "var(--color-forest)",
								margin: "0 0 var(--space-1) 0",
							}}
						>
							Strict Privacy Guarantee
						</h2>
						<p
							style={{
								fontSize: "var(--text-sm)",
								color: "var(--color-ink-secondary)",
								lineHeight: "var(--leading-normal)",
								margin: 0,
							}}
						>
							We never collect or display your exact street address or house
							number. Neighborhood circles only establish your general exchange
							boundary.
						</p>
					</div>
				</div>

				{/* Error display */}
				{error && (
					<div ref={alertRef} tabIndex={-1} style={{ outline: "none" }}>
						<InlineAlert
							variant="error"
							title="Neighborhood Selection Error"
							onClose={() => setError(null)}
						>
							{error}
						</InlineAlert>
					</div>
				)}

				{/* Neighborhood Selection List */}
				<section
					aria-label="Available Neighborhood Circles"
					style={{
						backgroundColor: "var(--color-bg-surface)",
						border: "1px solid var(--color-border)",
						borderRadius: "var(--radius-lg)",
						padding: "var(--space-6)",
						boxShadow: "var(--shadow-sm)",
					}}
				>
					<h2
						style={{
							fontSize: "var(--text-xl)",
							fontWeight: "var(--font-weight-bold)",
							color: "var(--color-ink-primary)",
							margin: "0 0 var(--space-4) 0",
						}}
					>
						Available Circles
					</h2>

					{isLoading ? (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "var(--space-3)",
								padding: "var(--space-8)",
								color: "var(--color-ink-muted)",
							}}
						>
							<Spinner size="md" />
							<span>Fetching local neighborhood circles...</span>
						</div>
					) : (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
								gap: "var(--space-4)",
							}}
						>
							{neighborhoods.map((n) => {
								const isSelected = selectedId === n.id;
								return (
									<button
										key={n.id}
										type="button"
										aria-pressed={isSelected}
										onClick={() => setSelectedId(n.id)}
										style={{
											display: "flex",
											flexDirection: "column",
											justifyContent: "space-between",
											padding: "var(--space-5)",
											backgroundColor: isSelected
												? "var(--color-forest-subtle)"
												: "var(--color-bg-base)",
											border: isSelected
												? "2px solid var(--color-forest)"
												: "1px solid var(--color-border)",
											borderRadius: "var(--radius-md)",
											cursor: "pointer",
											textAlign: "left",
											transition:
												"border-color 150ms ease, background-color 150ms ease",
											position: "relative",
										}}
									>
										<div>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													marginBottom: "var(--space-2)",
												}}
											>
												<span
													style={{
														fontSize: "var(--text-xs)",
														fontWeight: "var(--font-weight-semibold)",
														color: "var(--color-ink-muted)",
														textTransform: "uppercase",
														letterSpacing: "0.04em",
														display: "flex",
														alignItems: "center",
														gap: "var(--space-1)",
													}}
												>
													<MapPin size={14} />
													{n.city}, {n.state}
												</span>
												{isSelected && (
													<CheckCircle
														size={20}
														weight="fill"
														style={{ color: "var(--color-forest)" }}
													/>
												)}
											</div>

											<h3
												style={{
													fontSize: "var(--text-lg)",
													fontWeight: "var(--font-weight-bold)",
													color: "var(--color-ink-primary)",
													margin: "0 0 var(--space-2) 0",
												}}
											>
												{n.name}
											</h3>

											<p
												style={{
													fontSize: "var(--text-sm)",
													color: "var(--color-ink-secondary)",
													lineHeight: "var(--leading-normal)",
													margin: 0,
												}}
											>
												{n.description}
											</p>
										</div>
									</button>
								);
							})}
						</div>
					)}
				</section>

				{/* Footer Confirmation */}
				<footer
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "var(--space-4)",
						backgroundColor: "var(--color-bg-surface)",
						border: "1px solid var(--color-border)",
						borderRadius: "var(--radius-lg)",
						padding: "var(--space-6)",
					}}
				>
					<div>
						<span
							style={{
								fontSize: "var(--text-xs)",
								color: "var(--color-ink-muted)",
								display: "block",
							}}
						>
							Selected Circle
						</span>
						<strong
							style={{
								fontSize: "var(--text-base)",
								color: "var(--color-ink-primary)",
							}}
						>
							{currentNeighborhood
								? `${currentNeighborhood.name} (${currentNeighborhood.city}, ${currentNeighborhood.state})`
								: "None selected"}
						</strong>
					</div>

					<Button
						variant="primary"
						size="lg"
						isLoading={isSubmitting}
						disabled={isLoading || isSubmitting || !selectedId}
						onClick={handleConfirm}
						rightIcon={<ArrowRight size={18} />}
					>
						Confirm Neighborhood
					</Button>
				</footer>
			</main>
		</div>
	);
}

export default OnboardingPage;
