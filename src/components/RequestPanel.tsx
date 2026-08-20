import { CalendarBlank, Handshake, Info } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import {
	ApiError,
	type ApiRequestBody,
	apiRequest,
	isAbortError,
} from "../lib/api";
import type {
	ListingCondition,
	ListingDetail,
	RequestParticipant,
} from "../lib/contracts";
import styles from "./ExchangePanel.module.css";
import {
	Button,
	InlineAlert,
	Select,
	TextArea,
	TextField,
} from "./ui/Primitives";

export interface RequestPanelProps {
	listing: ListingDetail;
	onRequestCreated?: (request: RequestParticipant) => void;
	onReconcile?: () => void;
}

type FormErrors = Record<string, string>;

type OfferCondition = ListingCondition;

const conditionOptions = [
	{ value: "", label: "Select a condition" },
	{ value: "new", label: "New" },
	{ value: "like_new", label: "Like new" },
	{ value: "good", label: "Good" },
	{ value: "fair", label: "Fair" },
	{ value: "poor", label: "Poor" },
];

const fieldError = (error: ApiError, field: string) => {
	const value = error.fields?.[field];
	if (Array.isArray(value))
		return value.find((message) => typeof message === "string");
	return typeof value === "string" ? value : undefined;
};

export function RequestPanel({
	listing,
	onRequestCreated,
	onReconcile,
}: RequestPanelProps) {
	const { user } = useAuth();
	const [openingMessage, setOpeningMessage] = useState("");
	const [requestedStart, setRequestedStart] = useState("");
	const [requestedEnd, setRequestedEnd] = useState("");
	const [includeDates, setIncludeDates] = useState(false);
	const [offeredTitle, setOfferedTitle] = useState("");
	const [offeredDescription, setOfferedDescription] = useState("");
	const [offeredCondition, setOfferedCondition] = useState<OfferCondition | "">(
		"",
	);
	const [errors, setErrors] = useState<FormErrors>({});
	const [submitError, setSubmitError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const requestControllerRef = useRef<AbortController | null>(null);
	const currentListingIdRef = useRef(listing.id);
	const mountedRef = useRef(true);
	currentListingIdRef.current = listing.id;

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			requestControllerRef.current?.abort();
			requestControllerRef.current = null;
		};
	}, []);

	const isOwner = user?.id === listing.owner.id;
	const isDemo = user?.isDemo === true;
	const needsOffer = listing.type === "borrow" || listing.type === "trade";
	const needsDates = listing.type === "lend" || includeDates;
	const restriction =
		listing.type === "lend"
			? "Choose the full period you need. Both dates are required for lending requests."
			: listing.type === "borrow"
				? "Offer a specific item you can lend. Dates are optional unless you want to propose a handoff window."
				: "Propose a specific item to trade. You can include dates when they help plan the exchange.";

	if (isOwner) return null;

	if (isDemo) {
		return (
			<section className={styles.panel} aria-label="Request unavailable">
				<InlineAlert title="Demo mode is read-only" variant="info">
					Requests are unavailable in the demo so every neighbor’s exchange
					stays private.
				</InlineAlert>
			</section>
		);
	}

	if (listing.status !== "active") {
		return (
			<section className={styles.panel} aria-label="Request unavailable">
				<InlineAlert
					title="This listing is not accepting requests"
					variant="info"
				>
					Its current status is {listing.status}. Check another active listing
					to begin an exchange.
				</InlineAlert>
			</section>
		);
	}

	if (listing.isRequestedByViewer) {
		return (
			<section className={styles.panel} aria-label="Request unavailable">
				<InlineAlert
					title="You have already requested this listing"
					variant="info"
				>
					Open your request from the activity area to continue coordinating
					privately.
				</InlineAlert>
			</section>
		);
	}

	const validate = (): FormErrors => {
		const nextErrors: FormErrors = {};
		if (openingMessage.trim().length < 8) {
			nextErrors.openingMessage =
				"Add at least 8 characters to introduce your request.";
		}

		if (needsDates) {
			if (!requestedStart) nextErrors.requestedStart = "Choose a start date.";
			if (!requestedEnd) nextErrors.requestedEnd = "Choose an end date.";
			if (requestedStart && requestedEnd && requestedEnd < requestedStart) {
				nextErrors.requestedEnd =
					"The end date must be on or after the start date.";
			}
		}

		if (needsOffer) {
			if (offeredTitle.trim().length < 2) {
				nextErrors.offeredTitle = "Name the item you are offering.";
			}
			if (offeredDescription.trim().length < 8) {
				nextErrors.offeredDescription =
					"Describe the offered item in at least 8 characters.";
			}
			if (!offeredCondition) {
				nextErrors.offeredCondition = "Choose the item’s condition.";
			}
		}
		return nextErrors;
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSubmitting) return;

		const nextErrors = validate();
		setErrors(nextErrors);
		setSubmitError("");
		setSuccessMessage("");
		if (Object.keys(nextErrors).length > 0) return;

		const message = openingMessage.trim();
		let body: ApiRequestBody<"requestsCreate">;
		if (listing.type === "lend") {
			body = {
				listingType: "lend",
				openingMessage: message,
				requestedStart,
				requestedEnd,
			};
		} else {
			const dateFields = includeDates ? { requestedStart, requestedEnd } : {};
			const offeredItem = {
				title: offeredTitle.trim(),
				description: offeredDescription.trim(),
				condition: offeredCondition as OfferCondition,
			};
			body =
				listing.type === "borrow"
					? {
							listingType: "borrow",
							openingMessage: message,
							...dateFields,
							offeredItem,
						}
					: {
							listingType: "trade",
							openingMessage: message,
							...dateFields,
							offeredItem,
						};
		}

		const controller = new AbortController();
		requestControllerRef.current?.abort();
		requestControllerRef.current = controller;
		const requestListingId = listing.id;
		setIsSubmitting(true);
		try {
			const response = await apiRequest("requestsCreate", {
				params: { id: requestListingId },
				body,
				signal: controller.signal,
			});
			if (
				!mountedRef.current ||
				controller.signal.aborted ||
				currentListingIdRef.current !== requestListingId ||
				requestControllerRef.current !== controller
			) {
				return;
			}
			setSuccessMessage(
				"Your request was sent. You can now coordinate in the private thread.",
			);
			onRequestCreated?.(response.data);
			onReconcile?.();
		} catch (error) {
			if (
				isAbortError(error) ||
				!mountedRef.current ||
				controller.signal.aborted ||
				currentListingIdRef.current !== requestListingId ||
				requestControllerRef.current !== controller
			) {
				return;
			}
			if (error instanceof ApiError) {
				setErrors({
					openingMessage: fieldError(error, "openingMessage") || "",
					requestedStart: fieldError(error, "requestedStart") || "",
					requestedEnd: fieldError(error, "requestedEnd") || "",
					offeredTitle: fieldError(error, "offeredItem.title") || "",
					offeredDescription:
						fieldError(error, "offeredItem.description") || "",
					offeredCondition: fieldError(error, "offeredItem.condition") || "",
				});
				setSubmitError(error.message);
			} else {
				setSubmitError("Your request could not be sent. Please try again.");
			}
		} finally {
			if (
				mountedRef.current &&
				currentListingIdRef.current === requestListingId &&
				requestControllerRef.current === controller
			) {
				requestControllerRef.current = null;
				setIsSubmitting(false);
			}
		}
	};

	return (
		<section className={styles.panel} aria-labelledby="request-panel-heading">
			<header className={styles.header}>
				<p className={styles.eyebrow}>Start an exchange</p>
				<h2 className={styles.title} id="request-panel-heading">
					Request this {listing.type === "lend" ? "item" : "exchange"}
				</h2>
				<p className={styles.description}>
					Your note and any follow-up messages are visible only to you and the
					listing owner.
				</p>
			</header>

			<p className={styles.restriction}>
				<Info aria-hidden="true" size={16} weight="fill" /> {restriction}
			</p>

			<form className={styles.form} onSubmit={handleSubmit} noValidate>
				<TextArea
					label="A short note to the owner"
					value={openingMessage}
					onChange={(event) => setOpeningMessage(event.target.value)}
					error={errors.openingMessage || undefined}
					helpText="Include why this exchange works for you."
					maxLength={1500}
					required
				/>

				{needsOffer ? (
					<>
						<div className={styles.fieldGrid}>
							<TextField
								label="Item you’re offering"
								value={offeredTitle}
								onChange={(event) => setOfferedTitle(event.target.value)}
								error={errors.offeredTitle || undefined}
								maxLength={140}
								required
							/>
							<Select
								label="Its condition"
								value={offeredCondition}
								onChange={(event) =>
									setOfferedCondition(event.target.value as OfferCondition | "")
								}
								error={errors.offeredCondition || undefined}
								options={conditionOptions}
								required
							/>
						</div>
						<TextArea
							label="Describe the item"
							value={offeredDescription}
							onChange={(event) => setOfferedDescription(event.target.value)}
							error={errors.offeredDescription || undefined}
							maxLength={1000}
							required
						/>
						<label className={styles.cancelLabel}>
							<input
								type="checkbox"
								checked={includeDates}
								onChange={(event) => setIncludeDates(event.target.checked)}
							/>{" "}
							Include proposed exchange dates
						</label>
					</>
				) : null}

				{needsDates ? (
					<div className={styles.fieldGrid}>
						<TextField
							label="Start date"
							type="date"
							value={requestedStart}
							onChange={(event) => setRequestedStart(event.target.value)}
							error={errors.requestedStart || undefined}
							min={listing.availableFrom}
							max={listing.availableThrough}
							leftIcon={<CalendarBlank aria-hidden="true" size={18} />}
							required
						/>
						<TextField
							label="End date"
							type="date"
							value={requestedEnd}
							onChange={(event) => setRequestedEnd(event.target.value)}
							error={errors.requestedEnd || undefined}
							min={requestedStart || listing.availableFrom}
							max={listing.availableThrough}
							leftIcon={<CalendarBlank aria-hidden="true" size={18} />}
							required
						/>
					</div>
				) : null}

				{submitError ? (
					<InlineAlert
						className={styles.inlineError}
						title="Request not sent"
						variant="error"
					>
						{submitError}
					</InlineAlert>
				) : null}
				{successMessage ? (
					<p className={styles.statusMessage}>{successMessage}</p>
				) : null}

				<div className={styles.formActions}>
					<Button
						type="submit"
						isLoading={isSubmitting}
						leftIcon={<Handshake aria-hidden="true" size={18} weight="bold" />}
					>
						Send request
					</Button>
				</div>
			</form>
		</section>
	);
}
