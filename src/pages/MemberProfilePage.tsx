import { MapPin } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { ListingCard } from "../components/ListingCard";
import { ReviewList } from "../components/ReviewList";
import {
	Avatar,
	Button,
	InlineAlert,
	Skeleton,
} from "../components/ui/Primitives";
import { useApi } from "../hooks/useApi";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import {
	DEFAULT_PAGE_LIMIT,
	type MemberListingSummary,
	type ProfileExchangeHistoryItem,
} from "../lib/contracts";
import styles from "./MemberProfilePage.module.css";

const joinedDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "long",
	year: "numeric",
});

const completedDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
});

const LISTING_TYPE_LABEL: Record<
	ProfileExchangeHistoryItem["listingType"],
	string
> = {
	lend: "Lend",
	borrow: "Borrow",
	trade: "Trade",
};

const HISTORY_ROLE_LABEL: Record<ProfileExchangeHistoryItem["role"], string> = {
	owner: "Listing owner",
	requester: "Requester",
};

function ProfileSkeleton() {
	return (
		<div className={styles.loading} aria-label="Loading member profile">
			<Skeleton height="14rem" />
			<Skeleton height="10rem" />
			<Skeleton height="22rem" />
		</div>
	);
}

export function MemberProfilePage() {
	const { id: memberId } = useParams<{ id: string }>();
	const [listingItems, setListingItems] = useState<MemberListingSummary[]>([]);
	const [listingsForMember, setListingsForMember] = useState<string>();
	const [listingCursor, setListingCursor] = useState<string | null>(null);
	const [isLoadingMoreListings, setIsLoadingMoreListings] = useState(false);
	const [listingLoadError, setListingLoadError] = useState<string | null>(null);
	const [historyItems, setHistoryItems] = useState<
		ProfileExchangeHistoryItem[]
	>([]);
	const [historyForMember, setHistoryForMember] = useState<string>();
	const [historyCursor, setHistoryCursor] = useState<string | null>(null);
	const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
	const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
	const memberVersionRef = useRef(0);
	const activeMemberIdRef = useRef<string>();
	const listingControllerRef = useRef<AbortController>();
	const historyControllerRef = useRef<AbortController>();

	const memberRequest = useCallback(
		(signal: AbortSignal) => {
			if (!memberId)
				return Promise.reject(new Error("A member id is required."));
			return apiRequest("usersGetById", {
				params: { id: memberId },
				signal,
			}).then((response) => response.data);
		},
		[memberId],
	);
	const profile = useApi(memberRequest, {
		enabled: Boolean(memberId),
		dependencies: [memberId],
	});

	useEffect(() => {
		if (profile.state.data?.name) {
			document.title = `${profile.state.data.name} | Neighborly`;
		}
	}, [profile.state.data?.name]);

	const listingsRequest = useCallback(
		(signal: AbortSignal) => {
			if (!memberId)
				return Promise.reject(new Error("A member id is required."));
			return apiRequest("feed", {
				query: { ownerId: memberId, limit: DEFAULT_PAGE_LIMIT },
				signal,
			}).then((response) => response.data);
		},
		[memberId],
	);
	const listings = useApi(listingsRequest, {
		enabled: Boolean(memberId),
		dependencies: [memberId],
	});

	const historyRequest = useCallback(
		(signal: AbortSignal) => {
			if (!memberId)
				return Promise.reject(new Error("A member id is required."));
			return apiRequest("userHistory", {
				params: { id: memberId },
				query: { limit: DEFAULT_PAGE_LIMIT },
				signal,
			}).then((response) => response.data);
		},
		[memberId],
	);
	const history = useApi(historyRequest, {
		enabled: Boolean(memberId),
		dependencies: [memberId],
	});

	useEffect(() => {
		memberVersionRef.current += 1;
		activeMemberIdRef.current = memberId;
		listingControllerRef.current?.abort();
		listingControllerRef.current = undefined;
		historyControllerRef.current?.abort();
		historyControllerRef.current = undefined;
		setListingItems([]);
		setListingsForMember(undefined);
		setListingCursor(null);
		setIsLoadingMoreListings(false);
		setListingLoadError(null);
		setHistoryItems([]);
		setHistoryForMember(undefined);
		setHistoryCursor(null);
		setIsLoadingMoreHistory(false);
		setHistoryLoadError(null);
	}, [memberId]);

	useEffect(
		() => () => {
			listingControllerRef.current?.abort();
			historyControllerRef.current?.abort();
		},
		[],
	);

	useEffect(() => {
		if (
			listings.state.status !== "success" &&
			listings.state.status !== "empty"
		) {
			return;
		}
		const currentMemberId = activeMemberIdRef.current;
		if (!currentMemberId) return;
		setListingItems(listings.state.data.items);
		setListingsForMember(currentMemberId);
		setListingCursor(listings.state.data.nextCursor);
		setListingLoadError(null);
	}, [listings.state]);

	useEffect(() => {
		if (
			history.state.status !== "success" &&
			history.state.status !== "empty"
		) {
			return;
		}
		const currentMemberId = activeMemberIdRef.current;
		if (!currentMemberId) return;
		setHistoryItems(history.state.data.items);
		setHistoryForMember(currentMemberId);
		setHistoryCursor(history.state.data.nextCursor);
		setHistoryLoadError(null);
	}, [history.state]);

	const loadMoreListings = useCallback(async () => {
		const ownerId = activeMemberIdRef.current;
		if (!ownerId || !listingCursor || isLoadingMoreListings) return;
		const memberVersion = memberVersionRef.current;
		const controller = new AbortController();
		listingControllerRef.current?.abort();
		listingControllerRef.current = controller;
		setIsLoadingMoreListings(true);
		setListingLoadError(null);
		try {
			const response = await apiRequest("feed", {
				query: {
					ownerId,
					cursor: listingCursor,
					limit: DEFAULT_PAGE_LIMIT,
				},
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				memberVersion !== memberVersionRef.current ||
				activeMemberIdRef.current !== ownerId
			) {
				return;
			}
			setListingItems((current) => [
				...current,
				...response.data.items.filter(
					(next) => !current.some((listing) => listing.id === next.id),
				),
			]);
			setListingCursor(response.data.nextCursor);
		} catch (error) {
			if (
				isAbortError(error) ||
				controller.signal.aborted ||
				memberVersion !== memberVersionRef.current ||
				activeMemberIdRef.current !== ownerId
			) {
				return;
			}
			setListingLoadError(
				error instanceof ApiError
					? error.message
					: "We couldn’t load more listings.",
			);
		} finally {
			if (listingControllerRef.current === controller) {
				listingControllerRef.current = undefined;
				if (memberVersion === memberVersionRef.current) {
					setIsLoadingMoreListings(false);
				}
			}
		}
	}, [isLoadingMoreListings, listingCursor]);

	const loadMoreHistory = useCallback(async () => {
		const profileId = activeMemberIdRef.current;
		if (!profileId || !historyCursor || isLoadingMoreHistory) return;
		const memberVersion = memberVersionRef.current;
		const controller = new AbortController();
		historyControllerRef.current?.abort();
		historyControllerRef.current = controller;
		setIsLoadingMoreHistory(true);
		setHistoryLoadError(null);
		try {
			const response = await apiRequest("userHistory", {
				params: { id: profileId },
				query: { cursor: historyCursor, limit: DEFAULT_PAGE_LIMIT },
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				memberVersion !== memberVersionRef.current ||
				activeMemberIdRef.current !== profileId
			) {
				return;
			}
			setHistoryItems((current) => [
				...current,
				...response.data.items.filter(
					(next) =>
						!current.some(
							(historyItem) => historyItem.listingId === next.listingId,
						),
				),
			]);
			setHistoryCursor(response.data.nextCursor);
		} catch (error) {
			if (
				isAbortError(error) ||
				controller.signal.aborted ||
				memberVersion !== memberVersionRef.current ||
				activeMemberIdRef.current !== profileId
			) {
				return;
			}
			setHistoryLoadError(
				error instanceof ApiError
					? error.message
					: "We couldn’t load more completed exchanges.",
			);
		} finally {
			if (historyControllerRef.current === controller) {
				historyControllerRef.current = undefined;
				if (memberVersion === memberVersionRef.current) {
					setIsLoadingMoreHistory(false);
				}
			}
		}
	}, [historyCursor, isLoadingMoreHistory]);

	if (!memberId) {
		return (
			<main className={styles.page}>
				<InlineAlert title="Profile unavailable" variant="error">
					This member profile is missing its identifier.
				</InlineAlert>
			</main>
		);
	}

	if (profile.state.status === "loading" || profile.state.status === "idle") {
		return (
			<main className={styles.page}>
				<ProfileSkeleton />
			</main>
		);
	}

	if (profile.state.status === "offline") {
		return (
			<main className={styles.page}>
				<InlineAlert
					action={<Button onClick={profile.retry}>Try again</Button>}
					title="You’re offline"
					variant="warning"
				>
					Reconnect to view this member profile.
				</InlineAlert>
			</main>
		);
	}

	if (profile.state.status === "error") {
		return (
			<main className={styles.page}>
				<InlineAlert
					action={<Button onClick={profile.retry}>Try again</Button>}
					title="We couldn’t load this profile"
					variant="error"
				>
					{profile.state.error.message}
				</InlineAlert>
			</main>
		);
	}

	const member = profile.state.data;
	const responseHistory = member.responseHistory;
	const responseRate =
		responseHistory.responseRate === null
			? "No rate yet"
			: `${Math.round(responseHistory.responseRate * 100)}%`;
	const listingsReady =
		listingsForMember === memberId &&
		(listings.state.status === "success" || listings.state.status === "empty");
	const historyReady =
		historyForMember === memberId &&
		(history.state.status === "success" || history.state.status === "empty");
	const receivedReviews = historyItems.flatMap((historyItem) =>
		historyItem.review ? [historyItem.review] : [],
	);

	return (
		<main className={styles.page}>
			<header className={styles.profileHeader}>
				<Avatar
					alt={`${member.name}'s avatar`}
					className={styles.avatar}
					name={member.name}
					size="xl"
					src={member.avatarPath || undefined}
				/>
				<div className={styles.identity}>
					<p className={styles.eyebrow}>Neighbor profile</p>
					<div className={styles.nameRow}>
						<h1 className={styles.name}>{member.name}</h1>
						<p className={styles.handle}>@{member.handle}</p>
					</div>
					<p className={styles.tenure}>
						Neighbor since{" "}
						{joinedDateFormatter.format(new Date(member.joinedAt))}
					</p>
					<p className={styles.bio}>
						{member.bio || "No public introduction has been added."}
					</p>
					<p className={styles.neighborhood}>
						<MapPin aria-hidden="true" size={18} weight="fill" />
						{member.neighborhood.name}
					</p>
				</div>
			</header>

			<div className={styles.contentGrid}>
				<aside
					className={styles.reputation}
					aria-labelledby="reputation-heading"
				>
					<p className={styles.sectionEyebrow}>Exchange history</p>
					<h2 className={styles.sectionTitle} id="reputation-heading">
						A record of sharing
					</h2>

					<dl className={styles.stats}>
						<div className={styles.stat}>
							<dt className={styles.statLabel}>Completed exchanges</dt>
							<dd className={styles.statValue}>
								{member.completedExchangeCount}
							</dd>
							<p className={styles.statCopy}>
								Completed as either a listing owner or requester.
							</p>
						</div>
						<div className={styles.stat}>
							<dt className={styles.statLabel}>Response rate</dt>
							<dd className={styles.statValue}>{responseRate}</dd>
							<p className={styles.statCopy}>
								{responseHistory.respondedRequests} direct owner responses
								across {responseHistory.totalRequests} requests to their
								listings.
							</p>
						</div>
					</dl>
					<p className={styles.responseMeaning}>
						This history includes requests that are still pending or received a
						direct owner response. It excludes requests they sent and requests
						cancelled before the owner responded.
					</p>

					<ReviewList
						aggregateRating={member.aggregateRating}
						className={styles.reviewPanel}
						reviewCount={member.reviewCount}
						reviews={receivedReviews}
					/>
				</aside>

				<div className={styles.profileContent}>
					<section
						className={styles.history}
						aria-labelledby="completed-history-heading"
					>
						<div className={styles.sectionHeader}>
							<div>
								<p className={styles.sectionEyebrow}>Completed exchanges</p>
								<h2
									className={styles.sectionTitle}
									id="completed-history-heading"
								>
									Exchange timeline
								</h2>
							</div>
						</div>

						{history.state.status === "loading" ||
						history.state.status === "idle" ||
						(!historyReady &&
							history.state.status !== "offline" &&
							history.state.status !== "error") ? (
							<div
								className={styles.historyLoading}
								aria-label="Loading completed exchanges"
							>
								<Skeleton height="6rem" />
								<Skeleton height="6rem" />
							</div>
						) : null}
						{history.state.status === "offline" ? (
							<div className={styles.sectionAlert}>
								<InlineAlert
									action={<Button onClick={history.retry}>Try again</Button>}
									title="History needs a connection"
									variant="warning"
								>
									Reconnect to load completed exchanges.
								</InlineAlert>
							</div>
						) : null}
						{history.state.status === "error" ? (
							<div className={styles.sectionAlert}>
								<InlineAlert
									action={<Button onClick={history.retry}>Try again</Button>}
									title="We couldn’t load completed exchanges"
									variant="error"
								>
									{history.state.error.message}
								</InlineAlert>
							</div>
						) : null}
						{historyReady && historyItems.length === 0 ? (
							<p className={styles.emptySection}>
								No completed exchanges are recorded for this member yet.
							</p>
						) : null}
						{historyReady && historyItems.length > 0 ? (
							<ol className={styles.historyList}>
								{historyItems.map((historyItem) => (
									<li
										className={styles.historyItem}
										key={historyItem.listingId}
									>
										<div>
											<p className={styles.historyType}>
												{LISTING_TYPE_LABEL[historyItem.listingType]}
											</p>
											<h3>{historyItem.listingTitle}</h3>
											<p className={styles.historyRole}>
												Role: {HISTORY_ROLE_LABEL[historyItem.role]}
											</p>
										</div>
										<time
											dateTime={new Date(historyItem.completedAt).toISOString()}
										>
											Completed{" "}
											{completedDateFormatter.format(
												new Date(historyItem.completedAt),
											)}
										</time>
									</li>
								))}
							</ol>
						) : null}
						{historyCursor && historyReady ? (
							<div className={styles.loadMoreWrap}>
								{historyLoadError ? (
									<p className={styles.paginationError}>{historyLoadError}</p>
								) : null}
								<Button
									isLoading={isLoadingMoreHistory}
									onClick={() => void loadMoreHistory()}
									variant="outline"
								>
									Load more completed exchanges
								</Button>
							</div>
						) : null}
					</section>

					<section
						className={styles.listings}
						aria-labelledby="member-listings-heading"
					>
						<div className={styles.sectionHeader}>
							<div>
								<p className={styles.sectionEyebrow}>Neighbor listings</p>
								<h2
									className={styles.sectionTitle}
									id="member-listings-heading"
								>
									Listings
								</h2>
							</div>
						</div>

						{listings.state.status === "loading" ||
						listings.state.status === "idle" ||
						(!listingsReady &&
							listings.state.status !== "offline" &&
							listings.state.status !== "error") ? (
							<div className={styles.listingGrid} aria-label="Loading listings">
								<Skeleton height="22rem" />
								<Skeleton height="22rem" />
							</div>
						) : null}
						{listings.state.status === "offline" ? (
							<div className={styles.sectionAlert}>
								<InlineAlert
									action={<Button onClick={listings.retry}>Try again</Button>}
									title="Listings need a connection"
									variant="warning"
								>
									Reconnect to load this member’s listings.
								</InlineAlert>
							</div>
						) : null}
						{listings.state.status === "error" ? (
							<div className={styles.sectionAlert}>
								<InlineAlert
									action={<Button onClick={listings.retry}>Try again</Button>}
									title="We couldn’t load listings"
									variant="error"
								>
									{listings.state.error.message}
								</InlineAlert>
							</div>
						) : null}
						{listingsReady && listingItems.length === 0 ? (
							<p className={styles.emptySection}>
								This member has no current listings.
							</p>
						) : null}
						{listingsReady && listingItems.length > 0 ? (
							<div className={styles.listingGrid}>
								{listingItems.map((listing) => (
									<ListingCard key={listing.id} listing={listing} />
								))}
							</div>
						) : null}
						{listingCursor && listingsReady ? (
							<div className={styles.loadMoreWrap}>
								{listingLoadError ? (
									<p className={styles.paginationError}>{listingLoadError}</p>
								) : null}
								<Button
									isLoading={isLoadingMoreListings}
									onClick={() => void loadMoreListings()}
									variant="outline"
								>
									Load more listings
								</Button>
							</div>
						) : null}
					</section>
				</div>
			</div>
		</main>
	);
}
