import {
	ChatCircleText,
	CheckCircle,
	PaperPlaneTilt,
	Star,
	Tray,
	WarningCircle,
} from "@phosphor-icons/react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Link } from "react-router-dom";

import {
	Badge,
	type BadgeProps,
	Button,
	EmptyState,
	InlineAlert,
	Select,
	Skeleton,
} from "../components/ui/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import {
	DEFAULT_PAGE_LIMIT,
	MAX_MESSAGE_LENGTH,
	MAX_REVIEW_LENGTH,
	type MessageDto,
	type RequestAction,
	type RequestParticipant,
	type RequestStatus,
} from "../lib/contracts";
import styles from "./ActivityPage.module.css";

type RoleFilter = "owner" | "requester" | "all";
type ConfirmationAction = Exclude<RequestAction, "accept">;

type PendingConfirmation = {
	request: RequestParticipant;
	action: ConfirmationAction;
};

type Notice = {
	variant: "success" | "error";
	title: string;
	body: string;
};

const STATUS_PRESENTATION: Record<
	RequestStatus,
	{ label: string; variant: BadgeProps["variant"] }
> = {
	pending: { label: "Pending", variant: "warning" },
	accepted: { label: "Accepted", variant: "primary" },
	declined: { label: "Declined", variant: "neutral" },
	cancelled: { label: "Cancelled", variant: "neutral" },
	completed: { label: "Completed", variant: "success" },
};

const ACTION_COPY: Record<ConfirmationAction, { title: string; body: string }> =
	{
		decline: {
			title: "Decline this request?",
			body: "The requester will see that this request was declined. This cannot be undone from this inbox.",
		},
		cancel: {
			title: "Cancel this request?",
			body: "Cancelling ends the active request. Explain the change for the other participant.",
		},
		complete: {
			title: "Mark this exchange complete?",
			body: "This completes the request and its listing. It cannot be reopened from this inbox.",
		},
	};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
});

function formatTimestamp(timestamp: number) {
	return dateTimeFormatter.format(new Date(timestamp));
}

function formatDateOnly(date: string) {
	return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function RequestListSkeleton() {
	return (
		<div className={styles.requestPane} aria-label="Loading requests">
			<div className={styles.paneHeading}>
				<Skeleton height="2rem" width="8rem" />
			</div>
			<div className={styles.empty}>
				<Skeleton height="4rem" />
				<Skeleton height="4rem" />
				<Skeleton height="4rem" />
			</div>
		</div>
	);
}

export function ActivityPage() {
	const { user, isAuthenticated } = useAuth();
	const [role, setRole] = useState<RoleFilter>("owner");
	const [status, setStatus] = useState<RequestStatus | undefined>();
	const [requests, setRequests] = useState<RequestParticipant[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [selected, setSelected] = useState<RequestParticipant | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [mutationError, setMutationError] = useState<string | null>(null);
	const [mutatingRequestId, setMutatingRequestId] = useState<string | null>(
		null,
	);
	const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
		null,
	);
	const [cancellationReason, setCancellationReason] = useState("");
	const [confirmationError, setConfirmationError] = useState<string | null>(
		null,
	);
	const [messages, setMessages] = useState<MessageDto[]>([]);
	const [messageCursor, setMessageCursor] = useState<string | null>(null);
	const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
	const [messageLoadError, setMessageLoadError] = useState<string | null>(null);
	const [messageBody, setMessageBody] = useState("");
	const [messageError, setMessageError] = useState<string | null>(null);
	const [isSendingMessage, setIsSendingMessage] = useState(false);
	const [rating, setRating] = useState("5");
	const [reviewBody, setReviewBody] = useState("");
	const [reviewError, setReviewError] = useState<string | null>(null);
	const [isSubmittingReview, setIsSubmittingReview] = useState(false);
	const confirmationButtonRef = useRef<HTMLButtonElement>(null);
	const requestPageVersionRef = useRef(0);
	const threadVersionRef = useRef(0);
	const selectedRequestIdRef = useRef<string | undefined>(undefined);
	const loadMoreRequestsControllerRef = useRef<AbortController>();
	const loadMoreMessagesControllerRef = useRef<AbortController>();
	const messageCreateControllerRef = useRef<AbortController>();
	const reviewCreateControllerRef = useRef<AbortController>();
	const resetRequestDetail = useCallback(() => {
		threadVersionRef.current += 1;
		loadMoreMessagesControllerRef.current?.abort();
		loadMoreMessagesControllerRef.current = undefined;
		messageCreateControllerRef.current?.abort();
		messageCreateControllerRef.current = undefined;
		reviewCreateControllerRef.current?.abort();
		reviewCreateControllerRef.current = undefined;
		setMessages([]);
		setMessageCursor(null);
		setIsLoadingMoreMessages(false);
		setMessageLoadError(null);
		setMessageBody("");
		setMessageError(null);
		setIsSendingMessage(false);
		setReviewBody("");
		setReviewError(null);
		setIsSubmittingReview(false);
		setConfirmation(null);
		setConfirmationError(null);
		setCancellationReason("");
	}, []);

	const resetRequestView = useCallback(() => {
		requestPageVersionRef.current += 1;
		loadMoreRequestsControllerRef.current?.abort();
		loadMoreRequestsControllerRef.current = undefined;
		selectedRequestIdRef.current = undefined;
		setRequests([]);
		setNextCursor(null);
		setSelected(null);
		setIsLoadingMore(false);
		setLoadMoreError(null);
		setMutationError(null);
		resetRequestDetail();
	}, [resetRequestDetail]);

	const requestsRequest = useCallback(
		(signal: AbortSignal) =>
			apiRequest("requestsList", {
				query: {
					role,
					status,
					limit: DEFAULT_PAGE_LIMIT,
				},
				signal,
			}).then((response) => response.data),
		[role, status],
	);
	const requestFeed = useApi(requestsRequest, {
		enabled: Boolean(user),
		dependencies: [role, status, user?.id],
	});

	const selectedRequestId = selected?.id;
	const messagesRequest = useCallback(
		(signal: AbortSignal) => {
			if (!selectedRequestId) {
				return Promise.reject(new Error("No request is selected."));
			}
			return apiRequest("requestMessagesGet", {
				params: { id: selectedRequestId },
				query: { limit: DEFAULT_PAGE_LIMIT },
				signal,
			}).then((response) => response.data);
		},
		[selectedRequestId],
	);
	const messageFeed = useApi(messagesRequest, {
		enabled: Boolean(selectedRequestId && user),
		dependencies: [selectedRequestId, user?.id],
	});

	useEffect(() => {
		if (
			requestFeed.state.status !== "success" &&
			requestFeed.state.status !== "empty"
		) {
			return;
		}

		const page = requestFeed.state.data;
		const nextSelected = selected
			? (page.items.find((request) => request.id === selected.id) ??
				page.items[0] ??
				null)
			: (page.items[0] ?? null);
		if (nextSelected?.id !== selected?.id) resetRequestDetail();
		selectedRequestIdRef.current = nextSelected?.id;
		setRequests(page.items);
		setNextCursor(page.nextCursor);
		setSelected(nextSelected);
	}, [requestFeed.state, resetRequestDetail, selected]);

	useEffect(() => {
		if (
			messageFeed.state.status !== "success" &&
			messageFeed.state.status !== "empty"
		) {
			return;
		}

		setMessages(messageFeed.state.data.items);
		setMessageCursor(messageFeed.state.data.nextCursor);
	}, [messageFeed.state]);

	useEffect(() => {
		if (confirmation) confirmationButtonRef.current?.focus();
	}, [confirmation]);
	useEffect(
		() => () => {
			loadMoreRequestsControllerRef.current?.abort();
			loadMoreMessagesControllerRef.current?.abort();
			messageCreateControllerRef.current?.abort();
			reviewCreateControllerRef.current?.abort();
		},
		[],
	);

	const loadMoreRequests = useCallback(async () => {
		if (!nextCursor || isLoadingMore) return;
		const pageVersion = requestPageVersionRef.current;
		const controller = new AbortController();
		loadMoreRequestsControllerRef.current?.abort();
		loadMoreRequestsControllerRef.current = controller;
		setIsLoadingMore(true);
		setLoadMoreError(null);
		try {
			const response = await apiRequest("requestsList", {
				query: { role, status, cursor: nextCursor, limit: DEFAULT_PAGE_LIMIT },
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				pageVersion !== requestPageVersionRef.current
			) {
				return;
			}
			setRequests((current) => [
				...current,
				...response.data.items.filter(
					(next) => !current.some((request) => request.id === next.id),
				),
			]);
			setNextCursor(response.data.nextCursor);
		} catch (error) {
			if (
				isAbortError(error) ||
				controller.signal.aborted ||
				pageVersion !== requestPageVersionRef.current
			) {
				return;
			}
			setLoadMoreError(
				error instanceof ApiError
					? error.message
					: "We couldn’t load more requests.",
			);
		} finally {
			if (loadMoreRequestsControllerRef.current === controller) {
				loadMoreRequestsControllerRef.current = undefined;
				if (pageVersion === requestPageVersionRef.current) {
					setIsLoadingMore(false);
				}
			}
		}
	}, [isLoadingMore, nextCursor, role, status]);

	const loadMoreMessages = useCallback(async () => {
		if (!selected || !messageCursor || isLoadingMoreMessages) return;
		const requestId = selected.id;
		const threadVersion = threadVersionRef.current;
		const controller = new AbortController();
		loadMoreMessagesControllerRef.current?.abort();
		loadMoreMessagesControllerRef.current = controller;
		setIsLoadingMoreMessages(true);
		setMessageLoadError(null);
		try {
			const response = await apiRequest("requestMessagesGet", {
				params: { id: requestId },
				query: { cursor: messageCursor, limit: DEFAULT_PAGE_LIMIT },
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				threadVersion !== threadVersionRef.current ||
				selectedRequestIdRef.current !== requestId
			) {
				return;
			}
			setMessages((current) => [
				...response.data.items.filter(
					(next) => !current.some((message) => message.id === next.id),
				),
				...current,
			]);
			setMessageCursor(response.data.nextCursor);
		} catch (error) {
			if (
				isAbortError(error) ||
				controller.signal.aborted ||
				threadVersion !== threadVersionRef.current ||
				selectedRequestIdRef.current !== requestId
			) {
				return;
			}
			setMessageLoadError(
				error instanceof ApiError
					? error.message
					: "We couldn’t load more messages.",
			);
		} finally {
			if (loadMoreMessagesControllerRef.current === controller) {
				loadMoreMessagesControllerRef.current = undefined;
				if (
					threadVersion === threadVersionRef.current &&
					selectedRequestIdRef.current === requestId
				) {
					setIsLoadingMoreMessages(false);
				}
			}
		}
	}, [isLoadingMoreMessages, messageCursor, selected]);

	const reconcileRequest = useCallback(
		(updated: RequestParticipant) => {
			setRequests((current) => {
				if (!current.some((request) => request.id === updated.id))
					return current;
				if (status && updated.status !== status) {
					return current.filter((request) => request.id !== updated.id);
				}
				return current.map((request) =>
					request.id === updated.id ? updated : request,
				);
			});
			setSelected((current) =>
				current?.id === updated.id ? updated : current,
			);
		},
		[status],
	);

	const transitionRequest = useCallback(
		async (
			request: RequestParticipant,
			action: RequestAction,
			reason?: string,
		): Promise<boolean> => {
			setMutationError(null);
			setMutatingRequestId(request.id);
			try {
				const response = await apiRequest("requestTransition", {
					params: { id: request.id },
					body: { action, reason },
				});
				reconcileRequest(response.data);
				requestFeed.retry();
				setNotice({
					variant: "success",
					title: "Exchange updated",
					body: `This request is now ${STATUS_PRESENTATION[response.data.status].label.toLowerCase()}.`,
				});
				return true;
			} catch (error) {
				const message =
					error instanceof ApiError
						? error.message
						: "We couldn’t update this exchange.";
				setMutationError(message);
				setNotice({
					variant: "error",
					title: "Exchange wasn’t updated",
					body: message,
				});
				return false;
			} finally {
				setMutatingRequestId(null);
			}
		},
		[reconcileRequest, requestFeed.retry],
	);

	const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selected || !user || !isAuthenticated || user.isDemo) return;
		const body = messageBody.trim();
		if (!body) {
			setMessageError("Write a message before sending it.");
			return;
		}

		const requestId = selected.id;
		const threadVersion = threadVersionRef.current;
		const controller = new AbortController();
		messageCreateControllerRef.current?.abort();
		messageCreateControllerRef.current = controller;
		setMessageError(null);
		setIsSendingMessage(true);
		try {
			const response = await apiRequest("requestMessageCreate", {
				params: { id: requestId },
				body: { body },
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				threadVersion !== threadVersionRef.current ||
				selectedRequestIdRef.current !== requestId
			) {
				return;
			}
			setMessages((current) =>
				current.some((message) => message.id === response.data.id)
					? current
					: [...current, response.data],
			);
			setMessageBody("");
			setNotice({
				variant: "success",
				title: "Message sent",
				body: "Your message is now in this private exchange thread.",
			});
		} catch (error) {
			if (
				isAbortError(error) ||
				controller.signal.aborted ||
				threadVersion !== threadVersionRef.current ||
				selectedRequestIdRef.current !== requestId
			) {
				return;
			}
			setMessageError(
				error instanceof ApiError
					? error.message
					: "We couldn’t send your message.",
			);
		} finally {
			if (messageCreateControllerRef.current === controller) {
				messageCreateControllerRef.current = undefined;
				if (
					threadVersion === threadVersionRef.current &&
					selectedRequestIdRef.current === requestId
				) {
					setIsSendingMessage(false);
				}
			}
		}
	};

	const submitReview = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selected || !user || !isAuthenticated || user.isDemo) return;
		const body = reviewBody.trim();
		if (!body) {
			setReviewError("Write feedback before submitting your review.");
			return;
		}

		const requestId = selected.id;
		const threadVersion = threadVersionRef.current;
		const controller = new AbortController();
		reviewCreateControllerRef.current?.abort();
		reviewCreateControllerRef.current = controller;
		setReviewError(null);
		setIsSubmittingReview(true);
		try {
			await apiRequest("requestReviewCreate", {
				params: { id: requestId },
				body: { rating: Number(rating), body },
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				threadVersion !== threadVersionRef.current ||
				selectedRequestIdRef.current !== requestId
			) {
				return;
			}
			setRequests((current) =>
				current.map((request) =>
					request.id === requestId
						? { ...request, hasViewerReview: true }
						: request,
				),
			);
			setSelected((current) =>
				current?.id === requestId
					? { ...current, hasViewerReview: true }
					: current,
			);
			setReviewBody("");
			setNotice({
				variant: "success",
				title: "Review submitted",
				body: "Your feedback is now part of this completed exchange.",
			});
		} catch (error) {
			if (
				isAbortError(error) ||
				controller.signal.aborted ||
				threadVersion !== threadVersionRef.current ||
				selectedRequestIdRef.current !== requestId
			) {
				return;
			}
			setReviewError(
				error instanceof ApiError
					? error.message
					: "We couldn’t submit your review.",
			);
		} finally {
			if (reviewCreateControllerRef.current === controller) {
				reviewCreateControllerRef.current = undefined;
				if (
					threadVersion === threadVersionRef.current &&
					selectedRequestIdRef.current === requestId
				) {
					setIsSubmittingReview(false);
				}
			}
		}
	};

	if (!user) {
		return (
			<main className={styles.page}>
				<InlineAlert title="Activity is unavailable" variant="warning">
					Restore your session to view private exchange activity.
				</InlineAlert>
			</main>
		);
	}

	const canMutate = isAuthenticated && !user.isDemo;
	const isOwner = selected?.ownerId === user.id;
	const isRequester = selected?.requesterId === user.id;
	const hasReviewedSelected = selected?.hasViewerReview ?? false;

	return (
		<main className={styles.page}>
			<header className={styles.header}>
				<div>
					<p className={styles.eyebrow}>Private exchange activity</p>
					<h1 className={styles.title}>Requests and handoffs</h1>
					<p className={styles.subtitle}>
						Manage requests you receive and send, coordinate only with the other
						participant, and record a completed exchange.
					</p>
				</div>
			</header>

			<div className={styles.filters} aria-label="Filter exchange activity">
				<Select
					label="Mailbox"
					onChange={(event) => {
						const nextRole = event.target.value as RoleFilter;
						if (nextRole === role) return;
						resetRequestView();
						setRole(nextRole);
					}}
					options={[
						{ value: "owner", label: "Inbox — requests to my listings" },
						{ value: "requester", label: "Outbox — requests I sent" },
						{ value: "all", label: "All my requests" },
					]}
					value={role}
				/>
				<Select
					label="Status"
					onChange={(event) => {
						const nextStatus =
							event.target.value === ""
								? undefined
								: (event.target.value as RequestStatus);
						if (nextStatus === status) return;
						resetRequestView();
						setStatus(nextStatus);
					}}
					options={[
						{ value: "", label: "All statuses" },
						...Object.entries(STATUS_PRESENTATION).map(
							([value, presentation]) => ({
								value,
								label: presentation.label,
							}),
						),
					]}
					value={status ?? ""}
				/>
			</div>

			{notice ? (
				<div className={styles.notice} aria-live="polite">
					<InlineAlert
						onClose={() => setNotice(null)}
						title={notice.title}
						variant={notice.variant}
					>
						{notice.body}
					</InlineAlert>
				</div>
			) : null}

			{user.isDemo ? (
				<div className={styles.notice}>
					<InlineAlert title="Demo activity is read-only" variant="info">
						Demo sessions can view their own activity but cannot send messages,
						change a request, or submit reviews.
					</InlineAlert>
				</div>
			) : null}

			<div className={styles.workspace}>
				{requestFeed.state.status === "loading" ||
				requestFeed.state.status === "idle" ? (
					<RequestListSkeleton />
				) : requestFeed.state.status === "offline" ? (
					<div className={styles.requestPane}>
						<InlineAlert
							action={<Button onClick={requestFeed.retry}>Try again</Button>}
							title="You’re offline"
							variant="warning"
						>
							Reconnect to load your request inbox.
						</InlineAlert>
					</div>
				) : requestFeed.state.status === "error" ? (
					<div className={styles.requestPane}>
						<InlineAlert
							action={<Button onClick={requestFeed.retry}>Try again</Button>}
							title="We couldn’t load requests"
							variant="error"
						>
							{requestFeed.state.error.message}
						</InlineAlert>
					</div>
				) : (
					<aside
						className={styles.requestPane}
						aria-labelledby="requests-heading"
					>
						<div className={styles.paneHeading}>
							<p className={styles.sectionEyebrow}>Mailbox</p>
							<h2 id="requests-heading">
								{role === "owner"
									? "Inbox"
									: role === "requester"
										? "Outbox"
										: "All activity"}
							</h2>
						</div>
						{requests.length === 0 ? (
							<div className={styles.empty}>
								<EmptyState
									icon={<Tray size={28} weight="duotone" />}
									title="No requests here"
									description="Try another mailbox or status to see your exchange activity."
								/>
							</div>
						) : (
							<ol className={styles.requestList}>
								{requests.map((request) => (
									<li key={request.id}>
										<button
											aria-pressed={selected?.id === request.id}
											className={`${styles.requestButton} ${
												selected?.id === request.id
													? styles.requestButtonSelected
													: ""
											}`}
											onClick={() => {
												if (selected?.id !== request.id) resetRequestDetail();
												selectedRequestIdRef.current = request.id;
												setSelected(request);
											}}
											type="button"
										>
											<div className={styles.requestTopline}>
												<p className={styles.requestTitle}>
													{request.listingTitle}
												</p>
												<Badge
													variant={STATUS_PRESENTATION[request.status].variant}
												>
													{STATUS_PRESENTATION[request.status].label}
												</Badge>
											</div>
											<div className={styles.requestMeta}>
												<span className={styles.roleLabel}>
													{request.ownerId === user.id
														? "Incoming"
														: "Outgoing"}
												</span>
												<span>{formatTimestamp(request.updatedAt)}</span>
											</div>
										</button>
									</li>
								))}
							</ol>
						)}
						{nextCursor ? (
							<div className={styles.loadMoreWrap}>
								{loadMoreError ? (
									<p className={styles.paginationError}>{loadMoreError}</p>
								) : null}
								<button
									className={styles.loadMore}
									disabled={isLoadingMore}
									onClick={() => void loadMoreRequests()}
									type="button"
								>
									{isLoadingMore ? "Loading requests…" : "Load more requests"}
								</button>
							</div>
						) : null}
					</aside>
				)}

				<section
					className={styles.detailPane}
					aria-labelledby="request-detail-heading"
				>
					{selected ? (
						<>
							<header className={styles.detailHeader}>
								<p className={styles.sectionEyebrow}>
									{isOwner ? "Request to your listing" : "Request you sent"}
								</p>
								<h2 className={styles.detailTitle} id="request-detail-heading">
									{selected.listingTitle}
								</h2>
								<div className={styles.detailMeta}>
									<Badge variant={STATUS_PRESENTATION[selected.status].variant}>
										{STATUS_PRESENTATION[selected.status].label}
									</Badge>
									<span>Updated {formatTimestamp(selected.updatedAt)}</span>
									<Link to={`/listings/${selected.listingId}`}>
										View listing
									</Link>
								</div>
							</header>

							{selected.requestedStart && selected.requestedEnd ? (
								<p className={styles.dates}>
									<strong>Requested dates:</strong>{" "}
									{formatDateOnly(selected.requestedStart)}
									{" through "}
									{formatDateOnly(selected.requestedEnd)}
								</p>
							) : null}
							<p className={styles.openingMessage}>{selected.openingMessage}</p>
							{selected.offeredItem ? (
								<div className={styles.offer}>
									<strong>Offered item: {selected.offeredItem.title}</strong>
									<p>{selected.offeredItem.description}</p>
								</div>
							) : null}
							{selected.cancellationReason ? (
								<p className={styles.cancellation}>
									<strong>Cancellation note:</strong>{" "}
									{selected.cancellationReason}
								</p>
							) : null}

							{canMutate ? (
								<div className={styles.actionRow} aria-label="Request actions">
									{selected.status === "pending" && isOwner ? (
										<>
											<Button
												disabled={mutatingRequestId === selected.id}
												isLoading={mutatingRequestId === selected.id}
												leftIcon={<CheckCircle size={18} weight="bold" />}
												onClick={() =>
													void transitionRequest(selected, "accept")
												}
											>
												Accept request
											</Button>
											<Button
												disabled={mutatingRequestId === selected.id}
												onClick={() => {
													setConfirmation({
														request: selected,
														action: "decline",
													});
													setCancellationReason("");
													setConfirmationError(null);
												}}
												variant="outline"
											>
												Decline
											</Button>
										</>
									) : null}
									{selected.status === "pending" && isRequester ? (
										<Button
											disabled={mutatingRequestId === selected.id}
											onClick={() => {
												setConfirmation({
													request: selected,
													action: "cancel",
												});
												setCancellationReason("");
												setConfirmationError(null);
											}}
											variant="destructive"
										>
											Cancel request
										</Button>
									) : null}
									{selected.status === "accepted" && isOwner ? (
										<Button
											disabled={mutatingRequestId === selected.id}
											onClick={() => {
												setConfirmation({
													request: selected,
													action: "complete",
												});
												setCancellationReason("");
												setConfirmationError(null);
											}}
										>
											Mark complete
										</Button>
									) : null}
									{selected.status === "accepted" &&
									(isOwner || isRequester) ? (
										<Button
											disabled={mutatingRequestId === selected.id}
											onClick={() => {
												setConfirmation({
													request: selected,
													action: "cancel",
												});
												setCancellationReason("");
												setConfirmationError(null);
											}}
											variant="destructive"
										>
											Cancel exchange
										</Button>
									) : null}
								</div>
							) : null}

							{mutationError ? (
								<p className={styles.formError} role="alert">
									<WarningCircle aria-hidden="true" size={16} weight="fill" />{" "}
									{mutationError}
								</p>
							) : null}

							{confirmation ? (
								<aside
									className={styles.confirmation}
									aria-label="Confirm request action"
								>
									<h3>{ACTION_COPY[confirmation.action].title}</h3>
									<p>{ACTION_COPY[confirmation.action].body}</p>
									{confirmation.action === "cancel" ? (
										<label
											className={styles.confirmationLabel}
											htmlFor="cancellation-reason"
										>
											Why are you cancelling?
											<textarea
												id="cancellation-reason"
												maxLength={500}
												onChange={(event) =>
													setCancellationReason(event.target.value)
												}
												required
												rows={3}
												value={cancellationReason}
											/>
										</label>
									) : null}
									{confirmationError ? (
										<p className={styles.confirmationError} role="alert">
											{confirmationError}
										</p>
									) : null}
									<div className={styles.confirmationActions}>
										<Button
											ref={confirmationButtonRef}
											disabled={mutatingRequestId === confirmation.request.id}
											isLoading={mutatingRequestId === confirmation.request.id}
											onClick={() => {
												const reason = cancellationReason.trim();
												if (confirmation.action === "cancel" && !reason) {
													setConfirmationError(
														"A cancellation note is required.",
													);
													return;
												}
												void transitionRequest(
													confirmation.request,
													confirmation.action,
													confirmation.action === "cancel" ? reason : undefined,
												).then((updated) => {
													if (updated) setConfirmation(null);
												});
											}}
											variant={
												confirmation.action === "cancel"
													? "destructive"
													: "primary"
											}
										>
											Confirm {confirmation.action}
										</Button>
										<Button
											disabled={mutatingRequestId === confirmation.request.id}
											onClick={() => setConfirmation(null)}
											variant="ghost"
										>
											Keep request
										</Button>
									</div>
								</aside>
							) : null}

							<section
								className={styles.thread}
								aria-labelledby="thread-heading"
							>
								<div className={styles.threadHeader}>
									<div>
										<p className={styles.sectionEyebrow}>Participants only</p>
										<h3 id="thread-heading">Exchange thread</h3>
										<p>
											Messages are visible only to the two people in this
											request.
										</p>
									</div>
								</div>

								{messageFeed.state.status === "loading" ||
								messageFeed.state.status === "idle" ? (
									<div
										className={styles.messageList}
										aria-label="Loading messages"
									>
										<Skeleton height="4rem" width="72%" />
										<Skeleton height="4rem" width="62%" />
									</div>
								) : messageFeed.state.status === "offline" ? (
									<InlineAlert
										action={
											<Button onClick={messageFeed.retry}>Try again</Button>
										}
										title="Thread needs a connection"
										variant="warning"
									>
										Reconnect to view this private exchange thread.
									</InlineAlert>
								) : messageFeed.state.status === "error" ? (
									<InlineAlert
										action={
											<Button onClick={messageFeed.retry}>Try again</Button>
										}
										title="We couldn’t load messages"
										variant="error"
									>
										{messageFeed.state.error.message}
									</InlineAlert>
								) : messages.length === 0 ? (
									<p className={styles.threadEmpty}>
										No messages yet. Use this thread only to coordinate this
										exchange.
									</p>
								) : (
									<ol className={styles.messageList}>
										{messages.map((message) => (
											<li
												className={`${styles.message} ${
													message.senderId === user.id ? styles.messageOwn : ""
												}`}
												key={message.id}
											>
												<p className={styles.messageBody}>{message.body}</p>
												<div className={styles.messageMeta}>
													<span>
														{message.senderId === user.id
															? "You"
															: "Participant"}
													</span>
													<time
														dateTime={new Date(message.createdAt).toISOString()}
													>
														{formatTimestamp(message.createdAt)}
													</time>
												</div>
											</li>
										))}
									</ol>
								)}

								{messageCursor ? (
									<div className={styles.loadMoreWrap}>
										{messageLoadError ? (
											<p className={styles.paginationError}>
												{messageLoadError}
											</p>
										) : null}
										<button
											className={styles.loadMore}
											disabled={isLoadingMoreMessages}
											onClick={() => void loadMoreMessages()}
											type="button"
										>
											{isLoadingMoreMessages
												? "Loading earlier messages…"
												: "Load earlier messages"}
										</button>
									</div>
								) : null}

								{canMutate ? (
									<form className={styles.messageForm} onSubmit={submitMessage}>
										<label htmlFor="exchange-message">
											Message the participant
										</label>
										<textarea
											id="exchange-message"
											maxLength={MAX_MESSAGE_LENGTH}
											onChange={(event) => setMessageBody(event.target.value)}
											rows={3}
											value={messageBody}
										/>
										<div className={styles.formFooter}>
											<span>
												{messageBody.length} / {MAX_MESSAGE_LENGTH}
											</span>
											<Button
												disabled={!messageBody.trim()}
												isLoading={isSendingMessage}
												leftIcon={<PaperPlaneTilt size={18} weight="fill" />}
												type="submit"
											>
												Send message
											</Button>
										</div>
										{messageError ? (
											<p className={styles.formError} role="alert">
												{messageError}
											</p>
										) : null}
									</form>
								) : null}
							</section>

							{selected.status === "completed" ? (
								<section
									className={styles.review}
									aria-labelledby="review-heading"
								>
									<div className={styles.reviewHeading}>
										<div>
											<p className={styles.sectionEyebrow}>
												Completed exchange
											</p>
											<h3 id="review-heading">Leave a review</h3>
											<p>
												Share feedback based on this completed exchange only.
											</p>
										</div>
										<Star aria-hidden="true" size={28} weight="duotone" />
									</div>
									{canMutate && !hasReviewedSelected ? (
										<form className={styles.reviewForm} onSubmit={submitReview}>
											<label
												className={styles.reviewLabel}
												htmlFor="exchange-rating"
											>
												Rating
												<select
													id="exchange-rating"
													onChange={(event) => setRating(event.target.value)}
													value={rating}
												>
													<option value="5">5 — Great</option>
													<option value="4">4 — Good</option>
													<option value="3">3 — Okay</option>
													<option value="2">2 — Not great</option>
													<option value="1">1 — Poor</option>
												</select>
											</label>
											<label
												className={styles.reviewLabel}
												htmlFor="exchange-review"
											>
												Feedback
												<textarea
													id="exchange-review"
													maxLength={MAX_REVIEW_LENGTH}
													onChange={(event) =>
														setReviewBody(event.target.value)
													}
													rows={4}
													value={reviewBody}
												/>
											</label>
											<div className={styles.formFooter}>
												<span>
													{reviewBody.length} / {MAX_REVIEW_LENGTH}
												</span>
												<Button isLoading={isSubmittingReview} type="submit">
													Submit review
												</Button>
											</div>
											{reviewError ? (
												<p className={styles.formError} role="alert">
													{reviewError}
												</p>
											) : null}
										</form>
									) : hasReviewedSelected ? (
										<p className={styles.reviewDone}>
											You have already reviewed this exchange.
										</p>
									) : null}
								</section>
							) : null}
						</>
					) : (
						<div className={styles.detailEmpty}>
							<EmptyState
								icon={<ChatCircleText size={32} weight="duotone" />}
								title="Select a request"
								description="Choose an inbox or outbox request to see its exchange details."
							/>
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
