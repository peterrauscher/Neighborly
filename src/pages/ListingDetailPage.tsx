import {
	ArrowLeft,
	BookmarkSimple,
	CalendarBlank,
	CaretLeft,
	CaretRight,
	ChatCircle,
	HandHeart,
	ImageSquare,
	MapPin,
	PencilSimple,
	Trash,
	X,
} from "@phosphor-icons/react";
import {
	type FormEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import exchangeStyles from "../components/ExchangePanel.module.css";
import { MessageThread } from "../components/MessageThread";
import { RequestPanel } from "../components/RequestPanel";
import {
	Avatar,
	Badge,
	type BadgeProps,
	Button,
	EmptyState,
	InlineAlert,
	Select,
	Skeleton,
	TextArea,
	TextField,
} from "../components/ui/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import {
	ApiError,
	type ApiRequestBody,
	type ApiResponse,
	apiRequest,
	isAbortError,
} from "../lib/api";
import {
	DEFAULT_PAGE_LIMIT,
	type ListingCondition,
	type ListingDetail,
	MAX_COMMENT_LENGTH,
	MAX_PAGE_LIMIT,
	type RequestAction,
	type RequestParticipant,
	type RequestStatus,
} from "../lib/contracts";
import styles from "./ListingDetailPage.module.css";

type EditableListing = {
	title: string;
	description: string;
	category: string;
	condition: ListingCondition;
	availableFrom: string;
	availableThrough: string;
	availabilityNotes: string;
	wantedItem: string;
};

type EditErrors = Record<string, string>;
type CommentDto = ApiResponse<"listingCommentCreate">["data"];

type CommentPage = {
	items: CommentDto[];
	nextCursor: string | null;
};

function isEmptyCommentPage(response: { data: { items: CommentDto[] } }) {
	return response.data.items.length === 0;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "long",
	day: "numeric",
	year: "numeric",
});

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

const listingStatusPresentation: Record<
	ListingDetail["status"],
	{ label: string; variant: BadgeProps["variant"] }
> = {
	active: { label: "Active", variant: "success" },
	reserved: { label: "Reserved", variant: "warning" },
	completed: { label: "Completed", variant: "neutral" },
	withdrawn: { label: "Withdrawn", variant: "neutral" },
};

const requestStatusPresentation: Record<
	RequestStatus,
	{ label: string; variant: BadgeProps["variant"] }
> = {
	pending: { label: "Pending", variant: "warning" },
	accepted: { label: "Accepted", variant: "primary" },
	declined: { label: "Declined", variant: "neutral" },
	cancelled: { label: "Cancelled", variant: "neutral" },
	completed: { label: "Completed", variant: "success" },
};

const conditionOptions = [
	{ value: "new", label: "New" },
	{ value: "like_new", label: "Like new" },
	{ value: "good", label: "Good" },
	{ value: "fair", label: "Fair" },
	{ value: "poor", label: "Poor" },
];
function formatDate(value: string) {
	return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value: number) {
	return timestampFormatter.format(new Date(value));
}

function availabilityLabel(listing: ListingDetail) {
	const start = formatDate(listing.availableFrom);
	const end = formatDate(listing.availableThrough);
	return start === end ? start : `${start} to ${end}`;
}

function ListingDetailSkeleton() {
	return (
		<div className={styles.loading} aria-label="Loading listing">
			<Skeleton height="2.75rem" width="9rem" />
			<div className={styles.loadingHeader}>
				<Skeleton height="3.5rem" />
				<Skeleton height="3rem" />
			</div>
			<Skeleton height="min(58vw, 33rem)" />
			<Skeleton height="18rem" />
		</div>
	);
}

function commentError(error: unknown) {
	if (error instanceof ApiError) return error.message;
	return "The comment could not be updated. Please try again.";
}

function CommentsSection({
	listing,
	onReconcile,
}: {
	listing: ListingDetail;
	onReconcile: () => void;
}) {
	const { user } = useAuth();
	const [commentPage, setCommentPage] = useState<CommentPage>({
		items: [],
		nextCursor: null,
	});
	const [commentBody, setCommentBody] = useState("");
	const [commentErrorMessage, setCommentErrorMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
		null,
	);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState("");
	const loadMoreController = useRef<AbortController>();
	const createCommentControllerRef = useRef<AbortController | null>(null);
	const deleteCommentControllerRef = useRef<AbortController | null>(null);
	const currentCommentListingIdRef = useRef(listing.id);
	const commentsMountedRef = useRef(true);
	currentCommentListingIdRef.current = listing.id;

	const commentsRequest = useCallback(
		(signal: AbortSignal) =>
			apiRequest("listingCommentsGet", {
				params: { id: listing.id },
				query: { limit: DEFAULT_PAGE_LIMIT },
				signal,
			}),
		[listing.id],
	);
	const comments = useApi(commentsRequest, {
		dependencies: [listing.id],
		isEmpty: isEmptyCommentPage,
	});

	useEffect(() => {
		commentsMountedRef.current = true;
		return () => {
			commentsMountedRef.current = false;
			const loadMoreControllerValue = loadMoreController.current;
			loadMoreController.current = undefined;
			loadMoreControllerValue?.abort();
			createCommentControllerRef.current?.abort();
			createCommentControllerRef.current = null;
			deleteCommentControllerRef.current?.abort();
			deleteCommentControllerRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (
			comments.state.status !== "success" &&
			comments.state.status !== "empty"
		) {
			return;
		}
		setCommentPage({
			items: comments.state.data.data.items,
			nextCursor: comments.state.data.data.nextCursor,
		});
	}, [comments.state]);

	const createComment = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSubmitting) return;
		const body = commentBody.trim();
		if (!body) {
			setCommentErrorMessage("Write a comment before posting it.");
			return;
		}

		const controller = new AbortController();
		createCommentControllerRef.current?.abort();
		createCommentControllerRef.current = controller;
		const commentListingId = listing.id;
		setCommentErrorMessage("");
		setIsSubmitting(true);
		try {
			await apiRequest("listingCommentCreate", {
				params: { id: commentListingId },
				body: { body },
				signal: controller.signal,
			});
			if (
				!commentsMountedRef.current ||
				controller.signal.aborted ||
				currentCommentListingIdRef.current !== commentListingId ||
				createCommentControllerRef.current !== controller
			) {
				return;
			}
			setCommentBody("");
			comments.retry();
			onReconcile();
		} catch (error) {
			if (
				isAbortError(error) ||
				!commentsMountedRef.current ||
				controller.signal.aborted ||
				currentCommentListingIdRef.current !== commentListingId ||
				createCommentControllerRef.current !== controller
			) {
				return;
			}
			setCommentErrorMessage(commentError(error));
		} finally {
			if (
				commentsMountedRef.current &&
				currentCommentListingIdRef.current === commentListingId &&
				createCommentControllerRef.current === controller
			) {
				createCommentControllerRef.current = null;
				setIsSubmitting(false);
			}
		}
	};

	const deleteComment = async (commentId: string) => {
		if (deletingCommentId) return;

		const controller = new AbortController();
		deleteCommentControllerRef.current?.abort();
		deleteCommentControllerRef.current = controller;
		const commentListingId = listing.id;
		setCommentErrorMessage("");
		setDeletingCommentId(commentId);
		try {
			await apiRequest("commentDelete", {
				params: { id: commentId },
				signal: controller.signal,
			});
			if (
				!commentsMountedRef.current ||
				controller.signal.aborted ||
				currentCommentListingIdRef.current !== commentListingId ||
				deleteCommentControllerRef.current !== controller
			) {
				return;
			}
			comments.retry();
			onReconcile();
		} catch (error) {
			if (
				isAbortError(error) ||
				!commentsMountedRef.current ||
				controller.signal.aborted ||
				currentCommentListingIdRef.current !== commentListingId ||
				deleteCommentControllerRef.current !== controller
			) {
				return;
			}
			setCommentErrorMessage(commentError(error));
		} finally {
			if (
				commentsMountedRef.current &&
				currentCommentListingIdRef.current === commentListingId &&
				deleteCommentControllerRef.current === controller
			) {
				deleteCommentControllerRef.current = null;
				setDeletingCommentId(null);
			}
		}
	};

	const loadMore = async () => {
		if (!commentPage.nextCursor || isLoadingMore) return;
		loadMoreController.current?.abort();
		const controller = new AbortController();
		loadMoreController.current = controller;
		setIsLoadingMore(true);
		setLoadMoreError("");
		setCommentErrorMessage("");
		try {
			const response = await apiRequest("listingCommentsGet", {
				params: { id: listing.id },
				query: { cursor: commentPage.nextCursor, limit: DEFAULT_PAGE_LIMIT },
				signal: controller.signal,
			});
			if (loadMoreController.current !== controller) return;
			setCommentPage((current) => ({
				items: [...current.items, ...response.data.items],
				nextCursor: response.data.nextCursor,
			}));
		} catch (error) {
			if (!isAbortError(error) && loadMoreController.current === controller) {
				setLoadMoreError("More comments could not be loaded.");
			}
		} finally {
			if (loadMoreController.current === controller) {
				loadMoreController.current = undefined;
				setIsLoadingMore(false);
			}
		}
	};

	return (
		<section className={styles.comments} aria-labelledby="comments-heading">
			<header className={styles.sectionHeader}>
				<div>
					<p className={styles.eyebrow}>Neighborhood discussion</p>
					<h2 className={styles.sectionTitle} id="comments-heading">
						Comments
					</h2>
					<p className={styles.sectionDescription}>
						Keep public questions about the item here. Exchange logistics belong
						in the private request thread.
					</p>
				</div>
			</header>

			{user?.isDemo ? (
				<InlineAlert
					className={styles.requestError}
					title="Demo mode is read-only"
					variant="info"
				>
					Public comments are visible in demo mode, but only non-demo neighbors
					can add or remove them.
				</InlineAlert>
			) : (
				<form
					className={styles.commentComposer}
					onSubmit={createComment}
					noValidate
				>
					<TextArea
						label="Add a public comment"
						value={commentBody}
						onChange={(event) => setCommentBody(event.target.value)}
						maxLength={MAX_COMMENT_LENGTH}
						error={commentErrorMessage || undefined}
						rows={3}
						required
					/>
					<Button isLoading={isSubmitting} type="submit">
						Post comment
					</Button>
				</form>
			)}

			{comments.state.status === "loading" ||
			comments.state.status === "idle" ? (
				<div className={styles.commentList} aria-label="Loading comments">
					<Skeleton height="5rem" />
					<Skeleton height="5rem" />
				</div>
			) : null}

			{comments.state.status === "offline" ? (
				<InlineAlert
					action={<Button onClick={comments.retry}>Try again</Button>}
					className={styles.requestError}
					title="Comments need a connection"
					variant="warning"
				>
					Reconnect to read this listing’s discussion.
				</InlineAlert>
			) : null}

			{comments.state.status === "error" ? (
				<InlineAlert
					action={<Button onClick={comments.retry}>Try again</Button>}
					className={styles.requestError}
					title="We couldn’t load comments"
					variant="error"
				>
					{comments.state.error.message}
				</InlineAlert>
			) : null}

			{comments.state.status === "empty" ? (
				<EmptyState
					className={styles.requestError}
					icon={<ChatCircle aria-hidden="true" size={28} weight="duotone" />}
					title="No comments yet"
					description="Be the first to ask a useful public question about this listing."
				/>
			) : null}

			{comments.state.status === "success" && commentPage.items.length > 0 ? (
				<ol className={styles.commentList} aria-label="Listing comments">
					{commentPage.items.map((comment) => {
						const canDelete =
							user?.isDemo !== true &&
							(user?.id === comment.author.id || user?.id === listing.owner.id);
						return (
							<li className={styles.comment} key={comment.id}>
								<div className={styles.commentHeader}>
									<span className={styles.commentAuthor}>
										{comment.author.name}
									</span>
									<time
										className={styles.commentTime}
										dateTime={new Date(comment.createdAt).toISOString()}
									>
										{formatTimestamp(comment.createdAt)}
									</time>
								</div>
								<p className={styles.commentBody}>{comment.body}</p>
								{canDelete ? (
									<div className={styles.commentActions}>
										<Button
											disabled={deletingCommentId !== null}
											isLoading={deletingCommentId === comment.id}
											onClick={() => void deleteComment(comment.id)}
											size="sm"
											variant="tertiary"
										>
											Delete comment
										</Button>
									</div>
								) : null}
							</li>
						);
					})}
				</ol>
			) : null}
			{loadMoreError ? (
				<InlineAlert
					action={
						<Button
							disabled={isLoadingMore}
							onClick={() => void loadMore()}
							variant="secondary"
						>
							Try again
						</Button>
					}
					className={styles.requestError}
					title="More comments unavailable"
					variant="error"
				>
					{loadMoreError}
				</InlineAlert>
			) : null}

			{comments.state.status === "success" && commentPage.nextCursor ? (
				<Button
					className={styles.loadMore}
					disabled={isLoadingMore}
					isLoading={isLoadingMore}
					onClick={() => void loadMore()}
					variant="tertiary"
				>
					Load more comments
				</Button>
			) : null}
		</section>
	);
}

function RequestTransitionPanel({
	request,
	viewerId,
	onReconcile,
}: {
	request: RequestParticipant;
	viewerId: string;
	onReconcile: () => void;
}) {
	const [pendingAction, setPendingAction] = useState<RequestAction | null>(
		null,
	);
	const [reason, setReason] = useState("");
	const [error, setError] = useState("");
	const [isMutating, setIsMutating] = useState(false);
	const transitionControllerRef = useRef<AbortController | null>(null);
	const currentTransitionRequestIdRef = useRef(request.id);
	const transitionMountedRef = useRef(true);
	currentTransitionRequestIdRef.current = request.id;

	useEffect(() => {
		transitionMountedRef.current = true;
		return () => {
			transitionMountedRef.current = false;
			transitionControllerRef.current?.abort();
			transitionControllerRef.current = null;
		};
	}, []);

	const isOwner = request.ownerId === viewerId;
	const isRequester = request.requesterId === viewerId;
	const canAcceptOrDecline = request.status === "pending" && isOwner;
	const canCancel =
		(request.status === "pending" && isRequester) ||
		(request.status === "accepted" && (isOwner || isRequester));
	const canComplete = request.status === "accepted" && isOwner;

	if (!canAcceptOrDecline && !canCancel && !canComplete) return null;

	const transition = async (action: RequestAction) => {
		if (isMutating) return;
		if (action === "cancel" && !reason.trim()) {
			setError("Explain why you are cancelling this exchange.");
			return;
		}

		const controller = new AbortController();
		transitionControllerRef.current?.abort();
		transitionControllerRef.current = controller;
		const transitionRequestId = request.id;
		setError("");
		setIsMutating(true);
		try {
			await apiRequest("requestTransition", {
				params: { id: transitionRequestId },
				body:
					action === "cancel" ? { action, reason: reason.trim() } : { action },
				signal: controller.signal,
			});
			if (
				!transitionMountedRef.current ||
				controller.signal.aborted ||
				currentTransitionRequestIdRef.current !== transitionRequestId ||
				transitionControllerRef.current !== controller
			) {
				return;
			}
			setPendingAction(null);
			setReason("");
			onReconcile();
		} catch (caughtError) {
			if (
				isAbortError(caughtError) ||
				!transitionMountedRef.current ||
				controller.signal.aborted ||
				currentTransitionRequestIdRef.current !== transitionRequestId ||
				transitionControllerRef.current !== controller
			) {
				return;
			}
			setError(
				caughtError instanceof ApiError
					? caughtError.message
					: "The request could not be updated. Please try again.",
			);
		} finally {
			if (
				transitionMountedRef.current &&
				currentTransitionRequestIdRef.current === transitionRequestId &&
				transitionControllerRef.current === controller
			) {
				transitionControllerRef.current = null;
				setIsMutating(false);
			}
		}
	};

	return (
		<section
			className={exchangeStyles.transitionPanel}
			aria-labelledby="request-actions-heading"
		>
			<h3
				className={exchangeStyles.transitionTitle}
				id="request-actions-heading"
			>
				Request actions
			</h3>
			<p className={exchangeStyles.transitionCopy}>
				Only actions valid for your role and this request’s current status are
				available.
			</p>

			{pendingAction ? (
				<form
					className={exchangeStyles.cancellationForm}
					onSubmit={(event) => {
						event.preventDefault();
						void transition(pendingAction);
					}}
				>
					<p className={exchangeStyles.cancelLabel}>
						{pendingAction === "accept"
							? "Accept this request? Competing pending requests will be resolved by the server."
							: pendingAction === "decline"
								? "Decline this request? This cannot be undone from this listing."
								: pendingAction === "complete"
									? "Mark this exchange complete? This completes the listing too."
									: "Cancel this exchange? Tell the other participant why."}
					</p>
					{pendingAction === "cancel" ? (
						<TextArea
							label="Cancellation reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							maxLength={500}
							error={error || undefined}
							required
							rows={3}
						/>
					) : null}
					{pendingAction !== "cancel" && error ? (
						<InlineAlert title="Request not updated" variant="error">
							{error}
						</InlineAlert>
					) : null}
					<div className={exchangeStyles.transitionActions}>
						<Button
							isLoading={isMutating}
							type="submit"
							variant={
								pendingAction === "cancel" || pendingAction === "decline"
									? "destructive"
									: "primary"
							}
						>
							Confirm {pendingAction}
						</Button>
						<Button
							disabled={isMutating}
							onClick={() => {
								setPendingAction(null);
								setReason("");
								setError("");
							}}
							variant="secondary"
						>
							Keep request
						</Button>
					</div>
				</form>
			) : (
				<div
					className={exchangeStyles.transitionActions}
					aria-label="Valid request actions"
				>
					{canAcceptOrDecline ? (
						<>
							<Button onClick={() => setPendingAction("accept")}>
								Accept request
							</Button>
							<Button
								onClick={() => setPendingAction("decline")}
								variant="outline"
							>
								Decline request
							</Button>
						</>
					) : null}
					{canComplete ? (
						<Button onClick={() => setPendingAction("complete")}>
							Mark complete
						</Button>
					) : null}
					{canCancel ? (
						<Button
							onClick={() => setPendingAction("cancel")}
							variant="destructive"
						>
							{request.status === "pending"
								? "Cancel request"
								: "Cancel exchange"}
						</Button>
					) : null}
				</div>
			)}
		</section>
	);
}

function OwnerTools({
	listing,
	onReconcile,
}: {
	listing: ListingDetail;
	onReconcile: () => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [showWithdrawConfirmation, setShowWithdrawConfirmation] =
		useState(false);
	const [values, setValues] = useState<EditableListing>({
		title: listing.title,
		description: listing.description,
		category: listing.category,
		condition: listing.condition,
		availableFrom: listing.availableFrom,
		availableThrough: listing.availableThrough,
		availabilityNotes: listing.availabilityNotes || "",
		wantedItem: listing.wantedItem || "",
	});
	const [errors, setErrors] = useState<EditErrors>({});
	const [mutationError, setMutationError] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [isWithdrawing, setIsWithdrawing] = useState(false);
	const ownerMutationControllerRef = useRef<AbortController | null>(null);
	const currentOwnerListingIdRef = useRef(listing.id);
	const ownerToolsMountedRef = useRef(true);
	currentOwnerListingIdRef.current = listing.id;

	useEffect(() => {
		ownerToolsMountedRef.current = true;
		return () => {
			ownerToolsMountedRef.current = false;
			ownerMutationControllerRef.current?.abort();
			ownerMutationControllerRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!isEditing) {
			setValues({
				title: listing.title,
				description: listing.description,
				category: listing.category,
				condition: listing.condition,
				availableFrom: listing.availableFrom,
				availableThrough: listing.availableThrough,
				availabilityNotes: listing.availabilityNotes || "",
				wantedItem: listing.wantedItem || "",
			});
		}
	}, [isEditing, listing]);

	if (listing.status !== "active") return null;

	const saveEdits = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSaving || isWithdrawing) return;

		const nextErrors: EditErrors = {};
		if (values.title.trim().length < 4)
			nextErrors.title = "Use at least 4 characters.";
		if (values.description.trim().length < 10) {
			nextErrors.description = "Use at least 10 characters.";
		}
		if (values.category.trim().length < 2)
			nextErrors.category = "Use at least 2 characters.";
		if (values.availableThrough < values.availableFrom) {
			nextErrors.availableThrough =
				"The end date must be on or after the start date.";
		}
		if (listing.type !== "lend" && values.wantedItem.trim().length < 2) {
			nextErrors.wantedItem = "Name the item you want.";
		}
		setErrors(nextErrors);
		setMutationError("");
		if (Object.keys(nextErrors).length > 0) return;

		const body: ApiRequestBody<"listingPatch"> = {
			title: values.title.trim(),
			description: values.description.trim(),
			category: values.category.trim(),
			condition: values.condition,
			availableFrom: values.availableFrom,
			availableThrough: values.availableThrough,
			availabilityNotes: values.availabilityNotes.trim() || null,
			...(listing.type === "lend"
				? {}
				: { wantedItem: values.wantedItem.trim() }),
		};

		const controller = new AbortController();
		ownerMutationControllerRef.current?.abort();
		ownerMutationControllerRef.current = controller;
		const ownerListingId = listing.id;
		setIsSaving(true);
		try {
			await apiRequest("listingPatch", {
				params: { id: ownerListingId },
				body,
				signal: controller.signal,
			});
			if (
				!ownerToolsMountedRef.current ||
				controller.signal.aborted ||
				currentOwnerListingIdRef.current !== ownerListingId ||
				ownerMutationControllerRef.current !== controller
			) {
				return;
			}
			setIsEditing(false);
			onReconcile();
		} catch (error) {
			if (
				isAbortError(error) ||
				!ownerToolsMountedRef.current ||
				controller.signal.aborted ||
				currentOwnerListingIdRef.current !== ownerListingId ||
				ownerMutationControllerRef.current !== controller
			) {
				return;
			}
			setMutationError(
				error instanceof ApiError
					? error.message
					: "The listing could not be updated. Please try again.",
			);
		} finally {
			if (
				ownerToolsMountedRef.current &&
				currentOwnerListingIdRef.current === ownerListingId &&
				ownerMutationControllerRef.current === controller
			) {
				ownerMutationControllerRef.current = null;
				setIsSaving(false);
			}
		}
	};

	const withdraw = async () => {
		if (isSaving || isWithdrawing) return;

		const controller = new AbortController();
		ownerMutationControllerRef.current?.abort();
		ownerMutationControllerRef.current = controller;
		const ownerListingId = listing.id;
		setMutationError("");
		setIsWithdrawing(true);
		try {
			await apiRequest("listingPatch", {
				params: { id: ownerListingId },
				body: { action: "withdraw" },
				signal: controller.signal,
			});
			if (
				!ownerToolsMountedRef.current ||
				controller.signal.aborted ||
				currentOwnerListingIdRef.current !== ownerListingId ||
				ownerMutationControllerRef.current !== controller
			) {
				return;
			}
			setShowWithdrawConfirmation(false);
			onReconcile();
		} catch (error) {
			if (
				isAbortError(error) ||
				!ownerToolsMountedRef.current ||
				controller.signal.aborted ||
				currentOwnerListingIdRef.current !== ownerListingId ||
				ownerMutationControllerRef.current !== controller
			) {
				return;
			}
			setMutationError(
				error instanceof ApiError
					? error.message
					: "The listing could not be withdrawn. Please try again.",
			);
		} finally {
			if (
				ownerToolsMountedRef.current &&
				currentOwnerListingIdRef.current === ownerListingId &&
				ownerMutationControllerRef.current === controller
			) {
				ownerMutationControllerRef.current = null;
				setIsWithdrawing(false);
			}
		}
	};

	return (
		<section
			className={styles.ownerTools}
			aria-labelledby="owner-tools-heading"
		>
			<h2 className={styles.sectionTitle} id="owner-tools-heading">
				Manage listing
			</h2>
			<div className={styles.ownerActions}>
				<Button
					leftIcon={<PencilSimple aria-hidden="true" size={17} weight="bold" />}
					onClick={() => {
						setIsEditing((open) => !open);
						setMutationError("");
					}}
					variant="secondary"
				>
					{isEditing ? "Close editor" : "Edit listing"}
				</Button>
				<Button
					leftIcon={<Trash aria-hidden="true" size={17} weight="bold" />}
					onClick={() => setShowWithdrawConfirmation(true)}
					variant="destructive"
				>
					Withdraw
				</Button>
			</div>

			{mutationError ? (
				<InlineAlert title="Listing not updated" variant="error">
					{mutationError}
				</InlineAlert>
			) : null}

			{showWithdrawConfirmation ? (
				<div className={styles.confirmation}>
					<p>
						Withdraw this listing? It will no longer accept requests. Existing
						exchange history is retained.
					</p>
					<div className={styles.ownerActions}>
						<Button
							isLoading={isWithdrawing}
							onClick={() => void withdraw()}
							variant="destructive"
						>
							Confirm withdrawal
						</Button>
						<Button
							disabled={isWithdrawing}
							onClick={() => setShowWithdrawConfirmation(false)}
							variant="secondary"
						>
							Keep active
						</Button>
					</div>
				</div>
			) : null}

			{isEditing ? (
				<form className={styles.editForm} onSubmit={saveEdits} noValidate>
					<TextField
						label="Title"
						value={values.title}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								title: event.target.value,
							}))
						}
						error={errors.title}
						maxLength={120}
						required
					/>
					<TextArea
						label="Description"
						value={values.description}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								description: event.target.value,
							}))
						}
						error={errors.description}
						maxLength={2500}
						required
					/>
					<div className={styles.formGrid}>
						<TextField
							label="Category"
							value={values.category}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									category: event.target.value,
								}))
							}
							error={errors.category}
							maxLength={60}
							required
						/>
						<Select
							label="Condition"
							options={conditionOptions}
							value={values.condition}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									condition: event.target.value as ListingCondition,
								}))
							}
							required
						/>
					</div>
					<div className={styles.formGrid}>
						<TextField
							label="Available from"
							type="date"
							value={values.availableFrom}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									availableFrom: event.target.value,
								}))
							}
							required
						/>
						<TextField
							label="Available through"
							type="date"
							value={values.availableThrough}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									availableThrough: event.target.value,
								}))
							}
							error={errors.availableThrough}
							min={values.availableFrom}
							required
						/>
					</div>
					<TextArea
						label="Availability notes"
						value={values.availabilityNotes}
						onChange={(event) =>
							setValues((current) => ({
								...current,
								availabilityNotes: event.target.value,
							}))
						}
						maxLength={400}
						rows={2}
					/>
					{listing.type !== "lend" ? (
						<TextField
							label={
								listing.type === "borrow" ? "Item wanted" : "Trade item wanted"
							}
							value={values.wantedItem}
							onChange={(event) =>
								setValues((current) => ({
									...current,
									wantedItem: event.target.value,
								}))
							}
							error={errors.wantedItem}
							maxLength={140}
							required
						/>
					) : null}
					<div className={styles.formActions}>
						<Button isLoading={isSaving} type="submit">
							Save changes
						</Button>
						<Button
							disabled={isSaving}
							onClick={() => setIsEditing(false)}
							variant="tertiary"
						>
							Cancel editing
						</Button>
					</div>
				</form>
			) : null}
		</section>
	);
}

export function ListingDetailPage() {
	const { id: listingId } = useParams<{ id: string }>();
	return (
		<ListingDetailRoute
			key={listingId ?? "__missing-listing"}
			listingId={listingId}
		/>
	);
}

function ListingDetailRoute({ listingId }: { listingId: string | undefined }) {
	const [searchParams, setSearchParams] = useSearchParams();
	const { user } = useAuth();
	const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
	const [failedImageIds, setFailedImageIds] = useState<Set<string>>(
		() => new Set(),
	);
	const [interactionError, setInteractionError] = useState("");
	const [pendingInteraction, setPendingInteraction] = useState<
		"save" | "reaction" | null
	>(null);
	const interactionControllerRef = useRef<AbortController | null>(null);
	const currentListingIdRef = useRef(listingId);
	currentListingIdRef.current = listingId;

	useEffect(() => {
		return () => {
			interactionControllerRef.current?.abort();
			interactionControllerRef.current = null;
		};
	}, []);
	const lightboxRef = useRef<HTMLDialogElement>(null);
	const galleryTriggerRef = useRef<HTMLButtonElement | null>(null);

	const requestedRequestId = searchParams.get("request");
	const currentRequestedRequestIdRef = useRef(requestedRequestId);
	currentRequestedRequestIdRef.current = requestedRequestId;

	const listingRequest = useCallback(
		(signal: AbortSignal) => {
			if (!listingId) {
				return Promise.reject(
					new ApiError({
						status: 0,
						code: "VALIDATION_ERROR",
						message: "A listing id is required.",
					}),
				);
			}
			return apiRequest("listingGetById", {
				params: { id: listingId },
				signal,
			}).then((response) => response.data);
		},
		[listingId],
	);
	const listingResource = useApi(listingRequest, {
		enabled: Boolean(listingId),
		dependencies: [listingId],
	});

	useEffect(() => {
		if (listingResource.state.data?.title) {
			document.title = `${listingResource.state.data.title} | Neighborly`;
		}
	}, [listingResource.state.data?.title]);

	const selectedRequestQuery = useCallback(
		async (signal: AbortSignal) => {
			if (!requestedRequestId) {
				return { data: { items: [], nextCursor: null } };
			}

			let cursor: string | undefined;
			do {
				const response = await apiRequest("requestsList", {
					query: { role: "participant", cursor, limit: MAX_PAGE_LIMIT },
					signal,
				});
				const selected = response.data.items.find(
					(request) => request.id === requestedRequestId,
				);
				if (selected) {
					return { data: { items: [selected], nextCursor: null } };
				}
				cursor = response.data.nextCursor ?? undefined;
			} while (cursor);

			return { data: { items: [], nextCursor: null } };
		},
		[requestedRequestId],
	);
	const selectedRequestResource = useApi(selectedRequestQuery, {
		enabled: Boolean(requestedRequestId && user && !user.isDemo),
		dependencies: [requestedRequestId, user?.id, user?.isDemo],
	});

	const isLightboxOpen = activeImageIndex !== null;
	useEffect(() => {
		if (!isLightboxOpen) return;
		const dialog = lightboxRef.current;
		const priorOverflow = document.body.style.overflow;
		const focusableSelector = [
			"button:not([disabled])",
			"[href]",
			"input:not([disabled])",
			"select:not([disabled])",
			"textarea:not([disabled])",
			'[tabindex]:not([tabindex="-1"])',
		].join(",");

		document.body.style.overflow = "hidden";
		const closeButton = dialog?.querySelector<HTMLButtonElement>(
			"[data-lightbox-close]",
		);
		closeButton?.focus();

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setActiveImageIndex(null);
				return;
			}
			if (event.key !== "Tab" || !dialog) return;

			const focusable = Array.from(
				dialog.querySelectorAll<HTMLElement>(focusableSelector),
			).filter((element) => !element.hasAttribute("disabled"));
			if (focusable.length === 0) {
				event.preventDefault();
				dialog.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = priorOverflow;
			galleryTriggerRef.current?.focus();
		};
	}, [isLightboxOpen]);

	const reconcileListing = useCallback(
		(expectedListingId: string) => {
			if (currentListingIdRef.current !== expectedListingId) return;
			listingResource.retry();
		},
		[listingResource.retry],
	);

	const reconcileSelectedRequest = useCallback(
		(expectedRequestId: string) => {
			if (currentRequestedRequestIdRef.current !== expectedRequestId) return;
			selectedRequestResource.retry();
		},
		[selectedRequestResource.retry],
	);

	if (!listingId) {
		return (
			<main className={styles.page}>
				<InlineAlert title="Listing unavailable" variant="error">
					This listing address is missing its identifier.
				</InlineAlert>
			</main>
		);
	}

	if (
		listingResource.state.status === "loading" ||
		listingResource.state.status === "idle"
	) {
		return (
			<main className={styles.page}>
				<ListingDetailSkeleton />
			</main>
		);
	}

	if (listingResource.state.status === "offline") {
		return (
			<main className={styles.page}>
				<InlineAlert
					action={<Button onClick={listingResource.retry}>Try again</Button>}
					title="This listing needs a connection"
					variant="warning"
				>
					Reconnect to load the current listing details.
				</InlineAlert>
			</main>
		);
	}

	if (listingResource.state.status === "error") {
		return (
			<main className={styles.page}>
				<InlineAlert
					action={<Button onClick={listingResource.retry}>Try again</Button>}
					title="We couldn’t load this listing"
					variant="error"
				>
					{listingResource.state.error.message}
				</InlineAlert>
			</main>
		);
	}

	const listing = listingResource.state.data;
	const reconcileCurrentListing = () => reconcileListing(listing.id);
	const retrySelectedRequest = () => {
		if (requestedRequestId) {
			reconcileSelectedRequest(requestedRequestId);
		}
	};

	const availableImages = listing.images.filter(
		(image) => !failedImageIds.has(image.id),
	);
	const activeImage =
		activeImageIndex === null ? undefined : availableImages[activeImageIndex];
	const isOwner = listing.owner.id === user?.id;
	const canMutate = Boolean(user && !user.isDemo);
	const selectedRequest =
		selectedRequestResource.state.status === "success" ||
		selectedRequestResource.state.status === "empty"
			? selectedRequestResource.state.data.data.items.find(
					(request) =>
						request.id === requestedRequestId &&
						request.listingId === listing.id,
				)
			: undefined;
	const reconcileCurrentSelectedRequest = selectedRequest
		? () => reconcileSelectedRequest(selectedRequest.id)
		: undefined;

	const changeSelectedRequest = (request: RequestParticipant) => {
		const next = new URLSearchParams(searchParams);
		next.set("request", request.id);
		setSearchParams(next);
	};

	const mutateInteraction = async (kind: "save" | "reaction") => {
		if (!canMutate || pendingInteraction) return;

		const controller = new AbortController();
		interactionControllerRef.current?.abort();
		interactionControllerRef.current = controller;
		const interactionListingId = listing.id;
		const isActive =
			kind === "save" ? listing.isSavedByViewer : listing.hasViewerReaction;
		setInteractionError("");
		setPendingInteraction(kind);
		try {
			await apiRequest(
				kind === "save"
					? isActive
						? "listingDeleteSave"
						: "listingSave"
					: isActive
						? "listingReactionDelete"
						: "listingReaction",
				{
					params: { id: interactionListingId },
					signal: controller.signal,
				},
			);
			if (
				controller.signal.aborted ||
				interactionControllerRef.current !== controller ||
				currentListingIdRef.current !== interactionListingId
			) {
				return;
			}
			reconcileListing(interactionListingId);
		} catch (error) {
			if (
				isAbortError(error) ||
				controller.signal.aborted ||
				interactionControllerRef.current !== controller ||
				currentListingIdRef.current !== interactionListingId
			) {
				return;
			}
			setInteractionError(
				error instanceof ApiError
					? error.message
					: "That interaction could not be updated. Please try again.",
			);
		} finally {
			if (
				interactionControllerRef.current === controller &&
				currentListingIdRef.current === interactionListingId
			) {
				interactionControllerRef.current = null;
				setPendingInteraction(null);
			}
		}
	};

	const previousImage = () => {
		setActiveImageIndex((current) =>
			current === null || availableImages.length === 0
				? null
				: (current - 1 + availableImages.length) % availableImages.length,
		);
	};
	const nextImage = () => {
		setActiveImageIndex((current) =>
			current === null || availableImages.length === 0
				? null
				: (current + 1) % availableImages.length,
		);
	};
	const onLightboxKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
		if (event.key === "ArrowLeft" && availableImages.length > 1) {
			event.preventDefault();
			previousImage();
		}
		if (event.key === "ArrowRight" && availableImages.length > 1) {
			event.preventDefault();
			nextImage();
		}
	};

	return (
		<main className={styles.page}>
			<Link className={styles.backLink} to="/feed">
				<ArrowLeft aria-hidden="true" size={18} weight="bold" />
				Back to listings
			</Link>

			<header className={styles.introduction}>
				<div>
					<p className={styles.eyebrow}>
						{listing.type} · {listing.category}
					</p>
					<h1 className={styles.title}>{listing.title}</h1>
				</div>
				<div className={styles.introMeta}>
					<Badge variant={listingStatusPresentation[listing.status].variant}>
						{listingStatusPresentation[listing.status].label}
					</Badge>
				</div>
			</header>

			<div className={styles.layout}>
				<div className={styles.content}>
					<figure className={styles.gallery} aria-label="Listing images">
						{availableImages[0] ? (
							<button
								aria-label={`Open image 1 of ${availableImages.length}: ${availableImages[0].altText}`}
								className={styles.mainImageButton}
								onClick={(event) => {
									galleryTriggerRef.current = event.currentTarget;
									setActiveImageIndex(0);
								}}
								type="button"
							>
								<img
									alt={availableImages[0].altText}
									className={styles.mainImage}
									src={availableImages[0].url}
									onError={() =>
										setFailedImageIds((current) =>
											new Set(current).add(availableImages[0].id),
										)
									}
								/>
							</button>
						) : (
							<div className={styles.placeholder}>
								<ImageSquare aria-hidden="true" size={56} weight="duotone" />
								<span className={styles.srOnly}>
									No listing images are available.
								</span>
							</div>
						)}

						{availableImages.length > 1 ? (
							<ol
								className={styles.thumbnailList}
								aria-label="Open another listing image"
							>
								{availableImages.map((image, index) => (
									<li key={image.id}>
										<button
											aria-current={
												activeImageIndex === index ||
												(activeImageIndex === null && index === 0)
											}
											aria-label={`Open image ${index + 1} of ${availableImages.length}: ${image.altText}`}
											className={styles.thumbnail}
											onClick={(event) => {
												galleryTriggerRef.current = event.currentTarget;
												setActiveImageIndex(index);
											}}
											type="button"
										>
											<img
												alt=""
												src={image.url}
												onError={() =>
													setFailedImageIds((current) =>
														new Set(current).add(image.id),
													)
												}
											/>
										</button>
									</li>
								))}
							</ol>
						) : null}
					</figure>

					<section
						className={styles.summary}
						aria-labelledby="listing-summary-heading"
					>
						<h2 id="listing-summary-heading">About this listing</h2>
						<p className={styles.description}>{listing.description}</p>
						<dl className={styles.metadata}>
							<div className={styles.metadataItem}>
								<dt>Condition</dt>
								<dd>{listing.condition.replace("_", " ")}</dd>
							</div>
							<div className={styles.metadataItem}>
								<dt>Availability</dt>
								<dd>
									<CalendarBlank aria-hidden="true" size={15} weight="bold" />{" "}
									{availabilityLabel(listing)}
								</dd>
							</div>
							{listing.wantedItem ? (
								<div className={styles.metadataItem}>
									<dt>
										{listing.type === "trade"
											? "Wanted in trade"
											: "Item wanted"}
									</dt>
									<dd>{listing.wantedItem}</dd>
								</div>
							) : null}
							{listing.availabilityNotes ? (
								<div
									className={`${styles.metadataItem} ${styles.metadataWide}`}
								>
									<dt>Availability notes</dt>
									<dd>{listing.availabilityNotes}</dd>
								</div>
							) : null}
						</dl>
					</section>

					<section
						className={styles.owner}
						aria-labelledby="listing-owner-heading"
					>
						<Avatar
							alt={`${listing.owner.name}'s avatar`}
							name={listing.owner.name}
							size="lg"
							src={listing.owner.avatarPath || undefined}
						/>
						<div className={styles.ownerDetails}>
							<p className={styles.ownerLabel} id="listing-owner-heading">
								Listed by
							</p>
							<Link
								className={styles.ownerName}
								to={`/neighbors/${listing.owner.id}`}
							>
								{listing.owner.name}
							</Link>
							<p className={styles.ownerMeta}>
								<MapPin aria-hidden="true" size={14} weight="fill" />{" "}
								{listing.neighborhood}
							</p>
						</div>
					</section>

					<div
						className={styles.interactions}
						aria-label="Listing interactions"
					>
						<button
							aria-label={
								listing.isSavedByViewer
									? "Remove from saved listings"
									: "Save listing"
							}
							aria-pressed={listing.isSavedByViewer}
							className={styles.iconButton}
							disabled={!canMutate || pendingInteraction !== null}
							onClick={() => void mutateInteraction("save")}
							type="button"
						>
							<BookmarkSimple
								aria-hidden="true"
								size={18}
								weight={listing.isSavedByViewer ? "fill" : "regular"}
							/>
							{listing.savesCount}
						</button>
						<button
							aria-label={
								listing.hasViewerReaction
									? "Remove reaction"
									: "React to listing"
							}
							aria-pressed={listing.hasViewerReaction}
							className={styles.iconButton}
							disabled={!canMutate || pendingInteraction !== null}
							onClick={() => void mutateInteraction("reaction")}
							type="button"
						>
							<HandHeart
								aria-hidden="true"
								size={18}
								weight={listing.hasViewerReaction ? "fill" : "regular"}
							/>
							{listing.reactionsCount}
						</button>
						<span
							className={styles.signal}
							aria-label={`${listing.commentsCount} comments`}
						>
							<ChatCircle aria-hidden="true" size={18} />
							{listing.commentsCount}
						</span>
					</div>
					{user?.isDemo ? (
						<p className={styles.interactionError}>Demo mode is read-only.</p>
					) : null}
					{interactionError ? (
						<p className={styles.interactionError} role="alert">
							{interactionError}
						</p>
					) : null}

					<CommentsSection
						key={listing.id}
						listing={listing}
						onReconcile={reconcileCurrentListing}
					/>
				</div>

				<aside className={styles.sidebar} aria-label="Exchange tools">
					{isOwner && listing.status === "active" && canMutate ? (
						<section className={styles.sideSection}>
							<OwnerTools
								key={listing.id}
								listing={listing}
								onReconcile={reconcileCurrentListing}
							/>
						</section>
					) : isOwner ? (
						<section className={styles.sideSection}>
							<InlineAlert
								title={
									user?.isDemo
										? "Demo mode is read-only"
										: "This listing is not active"
								}
								variant="info"
							>
								{user?.isDemo
									? "Listing changes are unavailable in demo mode."
									: `It is currently ${listing.status}, so there are no owner actions to take here.`}
							</InlineAlert>
						</section>
					) : (
						<section className={styles.sideSection}>
							<RequestPanel
								key={listing.id}
								listing={listing}
								onReconcile={reconcileCurrentListing}
								onRequestCreated={changeSelectedRequest}
							/>
						</section>
					)}

					{requestedRequestId ? (
						<section className={styles.sideSection} aria-live="polite">
							{user?.isDemo ? (
								<InlineAlert
									title="Private requests are unavailable in demo mode"
									variant="info"
								>
									Demo sessions never expose a neighbor’s request or message
									history.
								</InlineAlert>
							) : null}
							{Boolean(user && !user.isDemo) &&
							(selectedRequestResource.state.status === "loading" ||
								selectedRequestResource.state.status === "idle") ? (
								<div
									className={styles.requestLoading}
									aria-label="Loading request"
								>
									<Skeleton height="2rem" />
									<Skeleton height="5rem" />
								</div>
							) : null}
							{selectedRequestResource.state.status === "offline" ? (
								<InlineAlert
									action={
										<Button onClick={retrySelectedRequest}>Try again</Button>
									}
									title="Request details need a connection"
									variant="warning"
								>
									Reconnect to load this private exchange.
								</InlineAlert>
							) : null}
							{selectedRequestResource.state.status === "error" ? (
								<InlineAlert
									action={
										<Button onClick={retrySelectedRequest}>Try again</Button>
									}
									title="This request is unavailable"
									variant="error"
								>
									{selectedRequestResource.state.error.message}
								</InlineAlert>
							) : null}
							{(selectedRequestResource.state.status === "success" ||
								selectedRequestResource.state.status === "empty") &&
							!selectedRequest ? (
								<EmptyState
									title="Request not available"
									description="Only the people taking part in a request can open its details."
								/>
							) : null}
							{selectedRequest ? (
								<div className={styles.requestSummary}>
									<p className={styles.eyebrow}>Private exchange</p>
									<h2 className={styles.requestSummaryTitle}>Your request</h2>
									<Badge
										variant={
											requestStatusPresentation[selectedRequest.status].variant
										}
									>
										{requestStatusPresentation[selectedRequest.status].label}
									</Badge>
									<p className={styles.requestSummaryCopy}>
										{selectedRequest.openingMessage}
									</p>
									<dl className={styles.requestFacts}>
										{selectedRequest.requestedStart &&
										selectedRequest.requestedEnd ? (
											<div>
												<dt>Dates</dt>
												<dd>
													{formatDate(selectedRequest.requestedStart)} to{" "}
													{formatDate(selectedRequest.requestedEnd)}
												</dd>
											</div>
										) : null}
										{selectedRequest.offeredItem ? (
											<div>
												<dt>Offer</dt>
												<dd>{selectedRequest.offeredItem.title}</dd>
											</div>
										) : null}
									</dl>
									{canMutate && user && reconcileCurrentSelectedRequest ? (
										<RequestTransitionPanel
											key={selectedRequest.id}
											onReconcile={() => {
												reconcileCurrentListing();
												reconcileCurrentSelectedRequest();
											}}
											request={selectedRequest}
											viewerId={user.id}
										/>
									) : null}
									<MessageThread
										key={selectedRequest.id}
										requestId={selectedRequest.id}
										onReconcile={reconcileCurrentSelectedRequest}
									/>
								</div>
							) : null}
						</section>
					) : null}
				</aside>
			</div>

			{activeImage !== undefined ? (
				<div
					className={styles.lightboxBackdrop}
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setActiveImageIndex(null);
					}}
				>
					<dialog
						aria-describedby="lightbox-caption"
						aria-label={`Image ${(activeImageIndex ?? 0) + 1} of ${availableImages.length}`}
						className={styles.lightbox}
						onKeyDown={onLightboxKeyDown}
						open
						ref={lightboxRef}
					>
						<header className={styles.lightboxHeader}>
							<p className={styles.lightboxCounter}>
								Image {(activeImageIndex ?? 0) + 1} of {availableImages.length}
							</p>
							<button
								aria-label="Close image viewer"
								className={styles.lightboxClose}
								data-lightbox-close
								onClick={() => setActiveImageIndex(null)}
								type="button"
							>
								<X aria-hidden="true" size={22} weight="bold" />
							</button>
						</header>
						<div className={styles.lightboxImageWrap}>
							<img
								alt={activeImage.altText}
								className={styles.lightboxImage}
								src={activeImage.url}
							/>
						</div>
						<footer className={styles.lightboxFooter}>
							<p className={styles.lightboxCaption} id="lightbox-caption">
								{activeImage.altText}
							</p>
							{availableImages.length > 1 ? (
								<div className={styles.lightboxNavigation}>
									<button
										aria-label="Previous image"
										className={styles.lightboxNav}
										onClick={previousImage}
										type="button"
									>
										<CaretLeft aria-hidden="true" size={22} weight="bold" />
									</button>
									<button
										aria-label="Next image"
										className={styles.lightboxNav}
										onClick={nextImage}
										type="button"
									>
										<CaretRight aria-hidden="true" size={22} weight="bold" />
									</button>
								</div>
							) : null}
						</footer>
					</dialog>
				</div>
			) : null}
		</main>
	);
}
