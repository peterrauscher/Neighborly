import { ArrowRight, CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button, InlineAlert, Skeleton } from "../components/ui/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { ApiError, type ApiResponse, apiRequest } from "../lib/api";
import styles from "./HomePage.module.css";

const exchangeModes = [
	{
		name: "Lend",
		detail:
			"List something you own, add a real availability window, and decide which request works for you.",
	},
	{
		name: "Borrow",
		detail:
			"Ask for a useful item with the dates and context that help a neighbor give a clear answer.",
	},
	{
		name: "Trade",
		detail:
			"Offer a specific item in return so both sides of a proposed exchange are clear from the start.",
	},
] as const;

const previewSkeletons = [
	{ key: "featured-preview", height: 310 },
	{ key: "supporting-preview-one", height: 220 },
	{ key: "supporting-preview-two", height: 220 },
] as const;

export function HomePage() {
	const { loginDemo } = useAuth();
	const navigate = useNavigate();
	const [isStartingDemo, setIsStartingDemo] = useState(false);
	const [demoError, setDemoError] = useState<string | null>(null);

	const getPreview = useCallback(
		(signal: AbortSignal) =>
			apiRequest("preview", {
				query: { limit: 3 },
				signal,
			}),
		[],
	);
	const isPreviewEmpty = useCallback(
		(response: ApiResponse<"preview">) => response.data.items.length === 0,
		[],
	);
	const { state: preview, retry: retryPreview } = useApi(getPreview, {
		dependencies: [getPreview],
		isEmpty: isPreviewEmpty,
	});

	const handleDemoStart = async () => {
		setDemoError(null);
		setIsStartingDemo(true);
		try {
			const user = await loginDemo();
			if (user) {
				navigate("/feed");
				return;
			}
			setDemoError("The demo session did not start. Please try again.");
		} catch (error) {
			setDemoError(
				error instanceof ApiError ? error.message : "The demo could not start.",
			);
		} finally {
			setIsStartingDemo(false);
		}
	};

	return (
		<main className={styles.page}>
			<section className={styles.hero} aria-labelledby="home-hero-heading">
				<div className={styles.heroCopy}>
					<p className={styles.eyebrow}>Neighborhood resource sharing</p>
					<h1 id="home-hero-heading">
						Borrow nearby.
						<br />
						Lend locally.
					</h1>
					<p className={styles.heroLead}>
						Neighborly helps a block share the tools, gear, and surplus that do
						not need to sit unused.
					</p>
					<div className={styles.heroActions}>
						<Button
							onClick={handleDemoStart}
							isLoading={isStartingDemo}
							rightIcon={<ArrowRight size={18} aria-hidden="true" />}
						>
							Try the read-only demo
						</Button>
						<Link className={styles.secondaryLink} to="/login?redirect=/feed">
							Explore the feed
						</Link>
					</div>
					<p className={styles.heroNote}>
						The demo is read-only. No shared private messages are included.
					</p>
					{demoError ? (
						<InlineAlert
							variant="error"
							title="Demo unavailable"
							className={styles.demoAlert}
						>
							{demoError}
						</InlineAlert>
					) : null}
				</div>
				<figure className={styles.heroVisual}>
					<img
						src="/images/neighborhood.png"
						alt="An isometric view of homes, a shop, and trees in one neighborhood"
						loading="eager"
						decoding="async"
					/>
				</figure>
			</section>

			<section
				className={styles.origin}
				id="story"
				tabIndex={-1}
				aria-labelledby="origin-heading"
			>
				<div className={styles.originMark} aria-hidden="true">
					<CheckCircle size={28} weight="fill" />
				</div>
				<div>
					<p className={styles.eyebrow}>
						Atlas Madness 2023 Grand Prize Winner
					</p>
					<h2 id="origin-heading">
						A 2023 prototype, rebuilt for a clear local exchange.
					</h2>
					<p>
						Neighborly won the Grand Prize at Atlas Madness 2023, a hackathon
						sponsored by Google and MongoDB. In 2026, it was rebuilt as a
						reproducible, local-first resource-sharing application.
					</p>
					<a
						className={styles.textLink}
						href="https://devpost.com/software/neighborly-42ghs1"
						target="_blank"
						rel="noreferrer"
					>
						View the 2023 submission
						<ArrowRight size={16} aria-hidden="true" />
					</a>
				</div>
			</section>

			<section
				className={styles.modes}
				id="how-it-works"
				tabIndex={-1}
				aria-labelledby="exchange-heading"
			>
				<div className={styles.sectionIntro}>
					<p className={styles.eyebrow}>One practical exchange at a time</p>
					<h2 id="exchange-heading">
						Lend, borrow, or trade without making the handoff vague.
					</h2>
					<p>
						A listing and its request keep the item, availability, and next
						decision in one accountable place.
					</p>
				</div>
				<div className={styles.modeGrid}>
					{exchangeModes.map((mode, index) => (
						<article className={styles.mode} key={mode.name}>
							<span className={styles.modeNumber} aria-hidden="true">
								0{index + 1}
							</span>
							<h3>{mode.name}</h3>
							<p>{mode.detail}</p>
						</article>
					))}
				</div>
			</section>

			<section
				className={styles.previewSection}
				id="public-preview"
				aria-labelledby="preview-heading"
			>
				<div className={styles.previewHeader}>
					<div>
						<p className={styles.eyebrow}>Public preview</p>
						<h2 id="preview-heading">
							A look at the resources waiting nearby.
						</h2>
					</div>
					<p>
						These are curated public listing summaries. Sign in to see a
						neighborhood feed and send a request.
					</p>
				</div>

				{preview.status === "success" ? (
					<ul
						className={styles.previewGrid}
						aria-label="Public listing previews"
					>
						{preview.data.data.items.map((listing) => {
							const image = listing.images[0];
							return (
								<li className={styles.previewItem} key={listing.id}>
									<article>
										{image ? (
											<img
												className={styles.listingImage}
												src={image.url}
												alt={image.altText}
												loading="lazy"
												decoding="async"
											/>
										) : null}
										<div className={styles.listingBody}>
											<p className={styles.listingType}>
												{listing.type.slice(0, 1).toUpperCase() +
													listing.type.slice(1)}
											</p>
											<h3>{listing.title}</h3>
											<p className={styles.listingDescription}>
												{listing.description}
											</p>
											<div className={styles.listingMeta}>
												<span>{listing.category}</span>
												<span>{listing.condition}</span>
												<span>{listing.neighborhood}</span>
											</div>
										</div>
									</article>
								</li>
							);
						})}
					</ul>
				) : null}

				{preview.status === "loading" || preview.status === "idle" ? (
					<ul
						className={styles.previewGrid}
						aria-label="Loading public listings"
						aria-busy="true"
					>
						{previewSkeletons.map((skeleton) => (
							<li className={styles.previewItem} key={skeleton.key}>
								<Skeleton height={skeleton.height} borderRadius="16px" />
							</li>
						))}
					</ul>
				) : null}

				{preview.status === "empty" ? (
					<InlineAlert
						variant="info"
						title="The public preview is ready for its first listing."
					>
						Create an account to explore the member feed when your neighborhood
						has active listings.
					</InlineAlert>
				) : null}

				{preview.status === "error" || preview.status === "offline" ? (
					<InlineAlert
						variant="error"
						title={
							preview.status === "offline"
								? "You appear to be offline."
								: "Public preview unavailable."
						}
						action={
							<Button variant="secondary" size="sm" onClick={retryPreview}>
								Try again
							</Button>
						}
					>
						{preview.error.message}
					</InlineAlert>
				) : null}
			</section>

			<section className={styles.trust} aria-labelledby="trust-heading">
				<div className={styles.trustIntro}>
					<p className={styles.eyebrow}>Responsible exchange</p>
					<h2 id="trust-heading">
						Useful handoffs need boundaries, not made-up verification.
					</h2>
					<p>
						Neighborly does not claim to verify addresses or identities. It
						keeps a smaller promise: clear request states and privacy boundaries
						that match the exchange.
					</p>
				</div>
				<ul className={styles.trustList}>
					<li>
						<ShieldCheck size={24} weight="fill" aria-hidden="true" />
						<div>
							<h3>Neighborhood, not street address</h3>
							<p>
								A selected neighborhood scopes member listings. Precise street
								addresses are not collected.
							</p>
						</div>
					</li>
					<li>
						<ShieldCheck size={24} weight="fill" aria-hidden="true" />
						<div>
							<h3>Private between request participants</h3>
							<p>
								Request details and messages are available only to the two
								people taking part in that exchange.
							</p>
						</div>
					</li>
					<li>
						<ShieldCheck size={24} weight="fill" aria-hidden="true" />
						<div>
							<h3>Reviews follow completion</h3>
							<p>
								A review is available only after a completed exchange, never as
								a shortcut to a trust claim.
							</p>
						</div>
					</li>
				</ul>
			</section>

			<section className={styles.closing} aria-labelledby="closing-heading">
				<div>
					<p className={styles.eyebrow}>Start with one useful thing</p>
					<h2 id="closing-heading">
						The next useful thing may already be on your block.
					</h2>
					<p>
						Create an account, choose a neighborhood, and make your first clear
						exchange.
					</p>
				</div>
				<Link className={styles.closingAction} to="/register">
					Create an account
					<ArrowRight size={18} aria-hidden="true" />
				</Link>
			</section>
		</main>
	);
}
