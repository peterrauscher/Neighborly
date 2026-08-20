import { ChatCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { ApiError, apiRequest, isAbortError } from "../lib/api";
import {
	DEFAULT_PAGE_LIMIT,
	MAX_MESSAGE_LENGTH,
	type MessageDto,
} from "../lib/contracts";
import styles from "./ExchangePanel.module.css";
import {
	Button,
	EmptyState,
	InlineAlert,
	Skeleton,
	TextArea,
} from "./ui/Primitives";

export interface MessageThreadProps {
	requestId: string;
	onReconcile?: () => void;
}

type ThreadPage = {
	items: MessageDto[];
	nextCursor: string | null;
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

function formatTimestamp(timestamp: number) {
	return timestampFormatter.format(new Date(timestamp));
}

function isEmptyMessagePage(response: { data: { items: MessageDto[] } }) {
	return response.data.items.length === 0;
}

export function MessageThread({ requestId, onReconcile }: MessageThreadProps) {
	const { user } = useAuth();
	const [thread, setThread] = useState<ThreadPage>({
		items: [],
		nextCursor: null,
	});
	const [body, setBody] = useState("");
	const [composerError, setComposerError] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState("");
	const loadMoreController = useRef<AbortController>();
	const sendControllerRef = useRef<AbortController | null>(null);
	const currentRequestIdRef = useRef(requestId);
	const mountedRef = useRef(true);
	currentRequestIdRef.current = requestId;

	const requestMessages = useCallback(
		(signal: AbortSignal) =>
			apiRequest("requestMessagesGet", {
				params: { id: requestId },
				query: { limit: DEFAULT_PAGE_LIMIT },
				signal,
			}),
		[requestId],
	);
	const messages = useApi(requestMessages, {
		enabled: Boolean(requestId && user && !user.isDemo),
		dependencies: [requestId, user?.isDemo],
		isEmpty: isEmptyMessagePage,
	});

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			const loadMoreControllerValue = loadMoreController.current;
			loadMoreController.current = undefined;
			loadMoreControllerValue?.abort();
			sendControllerRef.current?.abort();
			sendControllerRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (
			messages.state.status !== "success" &&
			messages.state.status !== "empty"
		) {
			return;
		}

		setThread({
			items: messages.state.data.data.items,
			nextCursor: messages.state.data.data.nextCursor,
		});
	}, [messages.state]);

	const loadMore = async () => {
		if (!thread.nextCursor || isLoadingMore) return;

		loadMoreController.current?.abort();
		const controller = new AbortController();
		loadMoreController.current = controller;
		setIsLoadingMore(true);
		setLoadMoreError("");
		try {
			const response = await apiRequest("requestMessagesGet", {
				params: { id: requestId },
				query: { cursor: thread.nextCursor, limit: DEFAULT_PAGE_LIMIT },
				signal: controller.signal,
			});
			if (loadMoreController.current !== controller) return;
			setThread((current) => ({
				items: [...response.data.items, ...current.items],
				nextCursor: response.data.nextCursor,
			}));
		} catch (error) {
			if (!isAbortError(error) && loadMoreController.current === controller) {
				setLoadMoreError("Earlier messages could not be loaded.");
			}
		} finally {
			if (loadMoreController.current === controller) {
				loadMoreController.current = undefined;
				setIsLoadingMore(false);
			}
		}
	};

	const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSending) return;

		const trimmedBody = body.trim();
		if (!trimmedBody) {
			setComposerError("Write a message before sending it.");
			return;
		}

		const controller = new AbortController();
		sendControllerRef.current?.abort();
		sendControllerRef.current = controller;
		const messageRequestId = requestId;
		setComposerError("");
		setIsSending(true);
		try {
			const response = await apiRequest("requestMessageCreate", {
				params: { id: messageRequestId },
				body: { body: trimmedBody },
				signal: controller.signal,
			});
			if (
				!mountedRef.current ||
				controller.signal.aborted ||
				currentRequestIdRef.current !== messageRequestId ||
				sendControllerRef.current !== controller
			) {
				return;
			}
			setThread((current) => {
				const withoutServerMessage = current.items.filter(
					(message) => message.id !== response.data.id,
				);
				return {
					...current,
					items: [...withoutServerMessage, response.data],
				};
			});
			setBody("");
			onReconcile?.();
		} catch (error) {
			if (
				isAbortError(error) ||
				!mountedRef.current ||
				controller.signal.aborted ||
				currentRequestIdRef.current !== messageRequestId ||
				sendControllerRef.current !== controller
			) {
				return;
			}
			setComposerError(
				error instanceof ApiError
					? error.message
					: "Your message could not be sent. Please try again.",
			);
		} finally {
			if (
				mountedRef.current &&
				currentRequestIdRef.current === messageRequestId &&
				sendControllerRef.current === controller
			) {
				sendControllerRef.current = null;
				setIsSending(false);
			}
		}
	};
	if (user?.isDemo) {
		return (
			<section
				className={styles.messageThread}
				aria-label="Private thread unavailable"
			>
				<InlineAlert
					title="Private threads are unavailable in demo mode"
					variant="info"
				>
					Demo sessions never expose another neighbor’s request or message
					history.
				</InlineAlert>
			</section>
		);
	}
	if (!user) {
		return (
			<section
				className={styles.messageThread}
				aria-label="Private thread unavailable"
			>
				<InlineAlert title="Private thread unavailable" variant="info">
					Sign in to open a request conversation.
				</InlineAlert>
			</section>
		);
	}

	return (
		<section
			className={styles.messageThread}
			aria-labelledby="message-thread-heading"
		>
			<header className={styles.messageHeader}>
				<div className={styles.header}>
					<p className={styles.eyebrow}>Private thread</p>
					<h2 className={styles.title} id="message-thread-heading">
						Coordinate the exchange
					</h2>
					<p className={styles.description}>
						Only the two request participants can read or send these messages.
					</p>
				</div>
			</header>

			{messages.state.status === "loading" ||
			messages.state.status === "idle" ? (
				<div
					className={styles.loadingRows}
					aria-label="Loading private messages"
				>
					<Skeleton height="4.25rem" />
					<Skeleton height="4.25rem" />
					<Skeleton height="3.5rem" />
				</div>
			) : null}

			{messages.state.status === "offline" ? (
				<InlineAlert
					className={styles.inlineError}
					title="Messages need a connection"
					variant="warning"
					action={<Button onClick={messages.retry}>Try again</Button>}
				>
					Reconnect to load this private thread.
				</InlineAlert>
			) : null}

			{messages.state.status === "error" ? (
				<InlineAlert
					action={<Button onClick={messages.retry}>Try again</Button>}
					className={styles.inlineError}
					title="We couldn’t load this thread"
					variant="error"
				>
					{messages.state.error.message}
				</InlineAlert>
			) : null}

			{messages.state.status === "empty" && thread.items.length === 0 ? (
				<EmptyState
					className={styles.inlineError}
					icon={<ChatCircle aria-hidden="true" size={28} weight="duotone" />}
					title="Start the conversation"
					description="Share the practical details of the exchange here."
				/>
			) : null}

			{(messages.state.status === "success" ||
				(messages.state.status === "empty" && thread.items.length > 0)) &&
			thread.items.length > 0 ? (
				<ol className={styles.messageList} aria-label="Private messages">
					{thread.items.map((message) => {
						const isOwnMessage = message.senderId === user?.id;
						return (
							<li
								className={[
									styles.message,
									isOwnMessage ? styles.ownMessage : "",
								]
									.filter(Boolean)
									.join(" ")}
								key={message.id}
							>
								<p className={styles.messageBody}>{message.body}</p>
								<div className={styles.messageFooter}>
									<span className={styles.messageMeta}>
										{isOwnMessage ? "You" : "Neighbor"} ·{" "}
										{formatTimestamp(message.createdAt)}
									</span>
									{message.readAt ? (
										<span className={styles.messageStatus}>
											Read {formatTimestamp(message.readAt)}
										</span>
									) : null}
								</div>
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
					className={styles.inlineError}
					title="Earlier messages unavailable"
					variant="error"
				>
					{loadMoreError}
				</InlineAlert>
			) : null}

			{messages.state.status === "success" && thread.nextCursor ? (
				<Button
					disabled={isLoadingMore}
					isLoading={isLoadingMore}
					onClick={() => void loadMore()}
					variant="tertiary"
				>
					Load earlier messages
				</Button>
			) : null}

			{messages.state.status === "success" ||
			messages.state.status === "empty" ? (
				<form className={styles.compose} onSubmit={sendMessage} noValidate>
					<TextArea
						label="Message"
						value={body}
						onChange={(event) => setBody(event.target.value)}
						error={composerError || undefined}
						maxLength={MAX_MESSAGE_LENGTH}
						rows={3}
						required
					/>
					<div className={styles.threadActions}>
						<Button
							type="submit"
							isLoading={isSending}
							leftIcon={
								<PaperPlaneTilt aria-hidden="true" size={17} weight="fill" />
							}
						>
							Send message
						</Button>
					</div>
				</form>
			) : null}
		</section>
	);
}
