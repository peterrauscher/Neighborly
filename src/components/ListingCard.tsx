import {
	BookmarkSimple,
	ChatCircle,
	HandHeart,
	ImageSquare,
	Info,
	MapPin,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { apiRequest } from "../lib/api";
import type { MemberListingSummary } from "../lib/contracts";
import styles from "./ListingCard.module.css";

export type ListingSummary = MemberListingSummary;

export interface ListingCardProps {
	listing: ListingSummary;
	onSaveChange?: (saved: boolean) => void;
	compact?: boolean;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});

const LISTING_TYPE_LABELS: Record<ListingSummary["type"], string> = {
	lend: "Lend",
	borrow: "Borrow",
	trade: "Trade",
};

export function ListingCard({
	listing,
	onSaveChange,
	compact = false,
}: ListingCardProps) {
	const { isAuthenticated, user } = useAuth();
	const [isSaved, setIsSaved] = useState(listing.isSavedByViewer);
	const [hasReaction, setHasReaction] = useState(listing.hasViewerReaction);
	const [isSaving, setIsSaving] = useState(false);
	const [isReacting, setIsReacting] = useState(false);
	const [failedImageId, setFailedImageId] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<{
		listingId: string;
		message: string;
	} | null>(null);

	const image = listing.images[0];
	const listingPath = `/listings/${encodeURIComponent(listing.id)}`;
	const canMutate = isAuthenticated && !user?.isDemo;
	const isDemo = isAuthenticated && user?.isDemo;
	const feedbackMessage =
		feedback?.listingId === listing.id ? feedback.message : "";

	useEffect(() => {
		setIsSaved(listing.isSavedByViewer);
	}, [listing.isSavedByViewer]);

	useEffect(() => {
		setHasReaction(listing.hasViewerReaction);
	}, [listing.hasViewerReaction]);

	const availability = useMemo(() => {
		const from = DATE_FORMATTER.format(
			new Date(`${listing.availableFrom}T12:00:00`),
		);
		const through = DATE_FORMATTER.format(
			new Date(`${listing.availableThrough}T12:00:00`),
		);
		return from === through
			? `Available ${from}`
			: `Available ${from} to ${through}`;
	}, [listing.availableFrom, listing.availableThrough]);

	const savesCount = Math.max(
		0,
		listing.savesCount +
			(isSaved === listing.isSavedByViewer ? 0 : isSaved ? 1 : -1),
	);
	const reactionsCount = Math.max(
		0,
		listing.reactionsCount +
			(hasReaction === listing.hasViewerReaction ? 0 : hasReaction ? 1 : -1),
	);

	const handleSave = async () => {
		if (!canMutate || isSaving) return;

		const previous = isSaved;
		const next = !previous;
		setFeedback(null);
		setIsSaved(next);
		onSaveChange?.(next);
		setIsSaving(true);

		try {
			await apiRequest(next ? "listingSave" : "listingDeleteSave", {
				params: { id: listing.id },
			});
		} catch {
			setIsSaved(previous);
			onSaveChange?.(previous);
			setFeedback({
				listingId: listing.id,
				message: "Your saved listing could not be updated. Please try again.",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleReaction = async () => {
		if (!canMutate || isReacting) return;

		const previous = hasReaction;
		const next = !previous;
		setFeedback(null);
		setHasReaction(next);
		setIsReacting(true);

		try {
			await apiRequest(next ? "listingReaction" : "listingReactionDelete", {
				params: { id: listing.id },
			});
		} catch {
			setHasReaction(previous);
			setFeedback({
				listingId: listing.id,
				message: "Your reaction could not be updated. Please try again.",
			});
		} finally {
			setIsReacting(false);
		}
	};

	return (
		<article
			className={[styles.card, compact ? styles.compact : ""]
				.filter(Boolean)
				.join(" ")}
		>
			<Link
				className={styles.mediaLink}
				to={listingPath}
				aria-label={`View ${listing.title}`}
			>
				<div className={styles.media}>
					{image && failedImageId !== image.id ? (
						<img
							className={styles.image}
							src={image.url}
							alt={image.altText}
							loading="lazy"
							decoding="async"
							onError={() => setFailedImageId(image.id)}
						/>
					) : (
						<div className={styles.imagePlaceholder} aria-hidden="true">
							<ImageSquare size={40} weight="duotone" />
						</div>
					)}
				</div>
			</Link>

			<div className={styles.content}>
				<div className={styles.overline}>
					<span>{LISTING_TYPE_LABELS[listing.type]}</span>
					<span className={styles.overlineSeparator} aria-hidden="true">
						/
					</span>
					<span>{listing.category}</span>
				</div>

				<div>
					<h2 className={styles.title}>
						<Link className={styles.titleLink} to={listingPath}>
							{listing.title}
						</Link>
					</h2>
					<p className={styles.description}>{listing.description}</p>
				</div>

				<dl className={styles.details}>
					<div className={styles.detailRow}>
						<dt className={styles.detailTerm}>Condition</dt>
						<dd className={styles.detailValue}>
							{listing.condition.replace(/_/g, " ")}
						</dd>
					</div>
					<div className={styles.detailRow}>
						<dt className={styles.detailTerm}>Availability</dt>
						<dd className={styles.detailValue}>{availability}</dd>
					</div>
				</dl>

				<div className={styles.ownerRow}>
					<span className={styles.ownerInitial} aria-hidden="true">
						{listing.owner.name.trim().charAt(0).toUpperCase() || "N"}
					</span>
					<span className={styles.ownerName}>{listing.owner.name}</span>
					<span className={styles.neighborhood}>
						<MapPin size={14} aria-hidden="true" />
						{listing.neighborhood}
					</span>
				</div>

				<div className={styles.signals}>
					<div className={styles.signalGroup}>
						{canMutate ? (
							<button
								type="button"
								className={`${styles.actionButton} ${styles.saveButton}`}
								onClick={handleSave}
								aria-pressed={isSaved}
								disabled={isSaving}
							>
								<BookmarkSimple
									size={18}
									weight={isSaved ? "fill" : "regular"}
									aria-hidden="true"
								/>
								{savesCount}
								<span className={styles.srOnly}>
									{isSaved ? "Remove from saved listings" : "Save listing"}
								</span>
							</button>
						) : (
							<span
								className={styles.signal}
								aria-label={`${savesCount} saves`}
							>
								<BookmarkSimple size={18} aria-hidden="true" />
								{savesCount}
							</span>
						)}

						{canMutate ? (
							<button
								type="button"
								className={styles.actionButton}
								onClick={handleReaction}
								aria-pressed={hasReaction}
								disabled={isReacting}
							>
								<HandHeart
									size={18}
									weight={hasReaction ? "fill" : "regular"}
									aria-hidden="true"
								/>
								{reactionsCount}
								<span className={styles.srOnly}>
									{hasReaction ? "Remove reaction" : "React to listing"}
								</span>
							</button>
						) : (
							<span
								className={styles.signal}
								aria-label={`${reactionsCount} reactions`}
							>
								<HandHeart size={18} aria-hidden="true" />
								{reactionsCount}
							</span>
						)}

						<span
							className={styles.signal}
							aria-label={`${listing.commentsCount} comments`}
						>
							<ChatCircle size={18} aria-hidden="true" />
							{listing.commentsCount}
						</span>
					</div>

					{isDemo && (
						<span className={styles.readOnlyNote}>
							<Info size={15} aria-hidden="true" />
							Demo mode is read-only
						</span>
					)}
				</div>

				{feedbackMessage && (
					<output className={styles.feedback}>{feedbackMessage}</output>
				)}
			</div>
		</article>
	);
}
