import { ArrowClockwise, FolderOpen, WifiSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { FeedFilters, type FeedFiltersValue } from "../components/FeedFilters";
import { ListingCard, type ListingSummary } from "../components/ListingCard";
import {
	Button,
	EmptyState,
	InlineAlert,
	Skeleton,
} from "../components/ui/Primitives";
import { useApi } from "../hooks/useApi";
import {
	type ApiResponse,
	type ApiRouteQuery,
	apiRequest,
	isAbortError,
} from "../lib/api";
import { DEFAULT_PAGE_LIMIT, MAX_SEARCH_QUERY_LENGTH } from "../lib/contracts";
import styles from "./FeedPage.module.css";

const FEED_FILTER_KEYS = [
	"q",
	"type",
	"category",
	"saved",
	"availableFrom",
	"availableThrough",
] as const;

const FEED_CATEGORIES = [
	"gardening",
	"kitchen",
	"outdoor",
	"seasonal",
	"sports",
	"tools",
] as const;

const FEED_SKELETON_IDS = [
	"feed-skeleton-1",
	"feed-skeleton-2",
	"feed-skeleton-3",
	"feed-skeleton-4",
	"feed-skeleton-5",
	"feed-skeleton-6",
] as const;

type FeedResponse = ApiResponse<"feed">;
type FeedRequestResult = { filterKey: string; response: FeedResponse };

const isFeedEmpty = (result: FeedRequestResult) =>
	result.response.data.items.length === 0;

function normalizeAvailabilityDate(value: string | null): string {
	const candidate = value?.trim() ?? "";
	if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";

	const date = new Date(`${candidate}T00:00:00.000Z`);
	return Number.isNaN(date.getTime()) ||
		date.toISOString().slice(0, 10) !== candidate
		? ""
		: candidate;
}

function createFeedQuery(
	filters: FeedFiltersValue,
	cursor?: string,
): ApiRouteQuery<"feed"> {
	const query: ApiRouteQuery<"feed"> = { limit: DEFAULT_PAGE_LIMIT };

	if (filters.q) query.q = filters.q;
	if (filters.type) query.type = filters.type;
	if (filters.category) query.category = filters.category;
	if (filters.saved) query.saved = true;
	if (
		filters.availableFrom &&
		filters.availableThrough &&
		filters.availableFrom <= filters.availableThrough
	) {
		query.availableFrom = filters.availableFrom;
		query.availableThrough = filters.availableThrough;
	}
	if (cursor) query.cursor = cursor;

	return query;
}

export default function FeedPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [items, setItems] = useState<ListingSummary[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loadedFilterKey, setLoadedFilterKey] = useState<string | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState("");
	const loadMoreControllerRef = useRef<AbortController>();

	const filters = useMemo<FeedFiltersValue>(() => {
		const requestedType = searchParams.get("type");
		const rawCategory = searchParams.get("category")?.trim() ?? "";
		const q = (searchParams.get("q")?.trim() ?? "").slice(
			0,
			MAX_SEARCH_QUERY_LENGTH,
		);

		return {
			q,
			type:
				requestedType === "lend" ||
				requestedType === "borrow" ||
				requestedType === "trade"
					? requestedType
					: "",
			category:
				rawCategory.length >= 2 && rawCategory.length <= 60 ? rawCategory : "",
			saved: searchParams.get("saved") === "true",
			availableFrom: normalizeAvailabilityDate(
				searchParams.get("availableFrom"),
			),
			availableThrough: normalizeAvailabilityDate(
				searchParams.get("availableThrough"),
			),
		};
	}, [searchParams]);

	const filterKey = JSON.stringify(filters);
	const requestFirstPage = useCallback(
		async (signal: AbortSignal): Promise<FeedRequestResult> => ({
			filterKey,
			response: await apiRequest("feed", {
				query: createFeedQuery(filters),
				signal,
			}),
		}),
		[filterKey, filters],
	);
	const { state, retry } = useApi(requestFirstPage, {
		dependencies: [filterKey],
		isEmpty: isFeedEmpty,
	});

	const visibleItems = loadedFilterKey === filterKey ? items : [];
	const visibleNextCursor = loadedFilterKey === filterKey ? nextCursor : null;
	const hasActiveFilters = Boolean(
		filters.q ||
			filters.type ||
			filters.category ||
			filters.saved ||
			filters.availableFrom ||
			filters.availableThrough,
	);
	const requestError =
		state.status === "error" || state.status === "offline"
			? state.error
			: undefined;
	const isInitialLoading =
		!requestError &&
		(loadedFilterKey !== filterKey ||
			((state.status === "idle" || state.status === "loading") &&
				visibleItems.length === 0));

	useEffect(() => {
		loadMoreControllerRef.current?.abort();
		loadMoreControllerRef.current = undefined;
		setItems([]);
		setNextCursor(null);
		setLoadedFilterKey((currentFilterKey) =>
			currentFilterKey === filterKey ? currentFilterKey : null,
		);
		setIsLoadingMore(false);
		setLoadMoreError("");
	}, [filterKey]);

	useEffect(() => {
		if (
			(state.status !== "success" && state.status !== "empty") ||
			state.data.filterKey !== filterKey
		) {
			return;
		}

		setItems(state.data.response.data.items);
		setNextCursor(state.data.response.data.nextCursor);
		setLoadedFilterKey(filterKey);
	}, [filterKey, state]);

	useEffect(
		() => () => {
			loadMoreControllerRef.current?.abort();
		},
		[],
	);

	const updateFilters = useCallback(
		(nextFilters: FeedFiltersValue) => {
			const nextSearchParams = new URLSearchParams(searchParams);
			for (const key of FEED_FILTER_KEYS) {
				nextSearchParams.delete(key);
			}

			if (nextFilters.q.trim()) nextSearchParams.set("q", nextFilters.q.trim());
			if (nextFilters.type) nextSearchParams.set("type", nextFilters.type);
			if (nextFilters.category) {
				nextSearchParams.set("category", nextFilters.category);
			}
			if (nextFilters.saved) nextSearchParams.set("saved", "true");
			if (nextFilters.availableFrom) {
				nextSearchParams.set("availableFrom", nextFilters.availableFrom);
			}
			if (nextFilters.availableThrough) {
				nextSearchParams.set("availableThrough", nextFilters.availableThrough);
			}

			setSearchParams(nextSearchParams, { replace: true });
		},
		[searchParams, setSearchParams],
	);

	const clearFilters = useCallback(() => {
		const nextSearchParams = new URLSearchParams(searchParams);
		for (const key of FEED_FILTER_KEYS) {
			nextSearchParams.delete(key);
		}
		setSearchParams(nextSearchParams, { replace: true });
	}, [searchParams, setSearchParams]);

	const handleSaveChange = useCallback((listingId: string, saved: boolean) => {
		setItems((currentItems) =>
			currentItems.map((listing) => {
				if (listing.id !== listingId || listing.isSavedByViewer === saved) {
					return listing;
				}

				return {
					...listing,
					isSavedByViewer: saved,
					savesCount: Math.max(0, listing.savesCount + (saved ? 1 : -1)),
				};
			}),
		);
	}, []);

	const loadMore = useCallback(async () => {
		if (!visibleNextCursor || isLoadingMore || loadMoreControllerRef.current)
			return;

		const controller = new AbortController();
		loadMoreControllerRef.current = controller;
		setIsLoadingMore(true);
		setLoadMoreError("");

		try {
			const response = await apiRequest("feed", {
				query: createFeedQuery(filters, visibleNextCursor),
				signal: controller.signal,
			});
			if (loadMoreControllerRef.current !== controller) return;

			setItems((currentItems) => {
				const ids = new Set(currentItems.map((listing) => listing.id));
				return currentItems.concat(
					response.data.items.filter((listing) => !ids.has(listing.id)),
				);
			});
			setNextCursor(response.data.nextCursor);
		} catch (error) {
			if (isAbortError(error) || loadMoreControllerRef.current !== controller)
				return;
			setLoadMoreError(
				typeof navigator !== "undefined" && navigator.onLine === false
					? "You are offline. Reconnect to load more listings."
					: "More listings could not be loaded. Please try again.",
			);
		} finally {
			if (loadMoreControllerRef.current === controller) {
				loadMoreControllerRef.current = undefined;
				setIsLoadingMore(false);
			}
		}
	}, [filters, isLoadingMore, visibleNextCursor]);

	return (
		<main className={styles.page}>
			<div className={styles.container}>
				<header className={styles.header}>
					<div>
						<p className={styles.eyebrow}>Neighborhood exchange</p>
						<h1 className={styles.title}>Find what is close by</h1>
						<p className={styles.introduction}>
							Browse active lend, borrow, and trade listings from your
							neighborhood.
						</p>
					</div>
					<p className={styles.resultsNote} aria-live="polite">
						{isInitialLoading
							? "Loading listings"
							: `${visibleItems.length} ${visibleItems.length === 1 ? "listing" : "listings"} shown`}
					</p>
				</header>

				<FeedFilters
					filters={filters}
					categories={FEED_CATEGORIES}
					onChange={updateFilters}
					onClear={clearFilters}
				/>

				<section
					className={styles.feedContent}
					aria-label="Neighborhood listings"
				>
					{requestError && visibleItems.length > 0 && (
						<InlineAlert
							className={styles.refreshNotice}
							variant={state.status === "offline" ? "warning" : "error"}
							title={
								state.status === "offline"
									? "You are offline"
									: "Listings could not be refreshed"
							}
							action={
								<Button variant="outline" size="sm" onClick={retry}>
									Try again
								</Button>
							}
						>
							{state.status === "offline"
								? "Reconnect to refresh the feed."
								: requestError.message}
						</InlineAlert>
					)}

					{isInitialLoading && (
						<ul className={styles.feedGrid} aria-label="Loading listings">
							{FEED_SKELETON_IDS.map((skeletonId) => (
								<li
									key={skeletonId}
									className={styles.skeletonCard}
									aria-hidden="true"
								>
									<Skeleton className={styles.skeletonMedia} width="100%" />
									<div className={styles.skeletonContent}>
										<Skeleton width="3.8rem" height="0.75rem" variant="text" />
										<Skeleton
											className={styles.skeletonTitle}
											width="100%"
											height="1.25rem"
										/>
										<Skeleton
											className={styles.skeletonCopy}
											width="100%"
											height="0.875rem"
										/>
									</div>
								</li>
							))}
						</ul>
					)}

					{requestError && visibleItems.length === 0 && !isInitialLoading && (
						<InlineAlert
							className={styles.state}
							variant={state.status === "offline" ? "warning" : "error"}
							title={
								state.status === "offline"
									? "You are offline"
									: "Listings are unavailable right now"
							}
							action={
								<Button
									variant="outline"
									size="sm"
									onClick={retry}
									leftIcon={<ArrowClockwise size={16} aria-hidden="true" />}
								>
									Try again
								</Button>
							}
						>
							{state.status === "offline" ? (
								<span>
									<WifiSlash size={16} aria-hidden="true" /> Reconnect and try
									again.
								</span>
							) : (
								requestError.message
							)}
						</InlineAlert>
					)}

					{state.status === "empty" && visibleItems.length === 0 && (
						<EmptyState
							className={styles.state}
							icon={
								<FolderOpen size={30} weight="duotone" aria-hidden="true" />
							}
							title={
								hasActiveFilters
									? "No listings match these filters"
									: "No active listings yet"
							}
							description={
								hasActiveFilters
									? "Try widening your search or clearing the filters."
									: "Check back soon for items your neighbors are sharing."
							}
							action={
								hasActiveFilters ? (
									<Button variant="outline" onClick={clearFilters}>
										Clear filters
									</Button>
								) : undefined
							}
						/>
					)}

					{visibleItems.length > 0 && (
						<>
							<ul className={styles.feedGrid}>
								{visibleItems.map((listing) => (
									<li key={listing.id}>
										<ListingCard
											listing={listing}
											onSaveChange={(saved) =>
												handleSaveChange(listing.id, saved)
											}
										/>
									</li>
								))}
							</ul>

							{visibleNextCursor && (
								<div className={styles.loadMoreArea}>
									{loadMoreError && (
										<output className={styles.loadMoreError}>
											{loadMoreError}
										</output>
									)}
									<Button
										className={styles.loadMoreButton}
										variant="outline"
										onClick={loadMore}
										isLoading={isLoadingMore}
									>
										Load more
									</Button>
								</div>
							)}
						</>
					)}
				</section>
			</div>
		</main>
	);
}
