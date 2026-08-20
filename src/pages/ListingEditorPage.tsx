import {
	ArrowClockwise,
	ArrowLeft,
	CircleNotch,
	ImageSquare,
	PencilSimple,
	Plus,
} from "@phosphor-icons/react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
	AvailabilityFields,
	type AvailabilityValues,
} from "../components/AvailabilityFields";
import {
	type ExistingListingImage,
	ImageUploader,
	type PendingListingImage,
} from "../components/ImageUploader";
import {
	Badge,
	Button,
	InlineAlert,
	Select,
	Spinner,
	TextArea,
	TextField,
} from "../components/ui/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { ApiError, type ApiRequestBody, apiRequest } from "../lib/api";
import {
	CreateListingInputSchema,
	type ListingCondition,
	type ListingDetail,
	ListingPatchFieldsSchema,
	type ListingType,
} from "../lib/contracts";
import styles from "./ListingEditorPage.module.css";

type ListingEditorForm = AvailabilityValues & {
	type: ListingType;
	title: string;
	category: string;
	condition: ListingCondition;
	description: string;
	wantedItem: string;
};

type FormField = keyof ListingEditorForm | "images" | "_form";
type FormErrors = Partial<Record<FormField, string>>;

const INITIAL_FORM: ListingEditorForm = {
	type: "lend",
	title: "",
	category: "",
	condition: "good",
	description: "",
	wantedItem: "",
	availableFrom: "",
	availableThrough: "",
	availabilityNotes: "",
};

const FORM_FIELD_ORDER: readonly FormField[] = [
	"title",
	"category",
	"condition",
	"description",
	"wantedItem",
	"availableFrom",
	"availableThrough",
	"availabilityNotes",
	"images",
	"_form",
];

const FIELD_LABELS: Record<FormField, string> = {
	type: "Listing type",
	title: "Title",
	category: "Category",
	condition: "Condition",
	description: "Description",
	wantedItem: "Wanted item",
	availableFrom: "Available from",
	availableThrough: "Available through",
	availabilityNotes: "Availability notes",
	images: "Photos",
	_form: "Listing",
};

const CONDITION_OPTIONS: { value: ListingCondition; label: string }[] = [
	{ value: "new", label: "New" },
	{ value: "like_new", label: "Like new" },
	{ value: "good", label: "Good" },
	{ value: "fair", label: "Fair" },
	{ value: "poor", label: "Poor" },
];

const TYPE_COPY: Record<ListingType, { label: string; description: string }> = {
	lend: {
		label: "Lend",
		description: "Offer an item for a neighbor to borrow.",
	},
	borrow: {
		label: "Borrow",
		description: "Ask neighbors for an item you need.",
	},
	trade: {
		label: "Trade",
		description: "Offer an item in exchange for another item.",
	},
};

const listingToForm = (listing: ListingDetail): ListingEditorForm => ({
	type: listing.type,
	title: listing.title,
	category: listing.category,
	condition: listing.condition,
	description: listing.description,
	wantedItem: listing.wantedItem ?? "",
	availableFrom: listing.availableFrom,
	availableThrough: listing.availableThrough,
	availabilityNotes: listing.availabilityNotes ?? "",
});

const asExistingImages = (
	images: ListingDetail["images"],
): ExistingListingImage[] =>
	images.map((image) => ({
		id: image.id,
		url: image.url,
		altText: image.altText,
		sortOrder: image.sortOrder,
	}));

const isAvailabilityValid = (form: ListingEditorForm, errors: FormErrors) => {
	if (!form.availableFrom) {
		errors.availableFrom = "Choose a start date.";
	}
	if (!form.availableThrough) {
		errors.availableThrough = "Choose an end date.";
	}
	if (
		form.availableFrom &&
		form.availableThrough &&
		form.availableThrough < form.availableFrom
	) {
		errors.availableThrough =
			"The end date must be on or after the start date.";
	}
};

const errorMessage = (error: unknown, fallback: string) =>
	error instanceof ApiError ? error.message : fallback;

export function ListingEditorPage() {
	const { id: listingId } = useParams<{ id: string }>();
	const isEditing = Boolean(listingId);
	const { state: authState, user, retrySession } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const [form, setForm] = useState<ListingEditorForm>(INITIAL_FORM);
	const [formErrors, setFormErrors] = useState<FormErrors>({});
	const [topError, setTopError] = useState<string | null>(null);
	const [pendingImages, setPendingImages] = useState<PendingListingImage[]>([]);
	const [existingImages, setExistingImages] = useState<ExistingListingImage[]>(
		[],
	);
	const [imageError, setImageError] = useState<string | undefined>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
	const [pendingUploadListingId, setPendingUploadListingId] = useState<
		string | null
	>(null);
	const [currentListing, setCurrentListing] = useState<ListingDetail | null>(
		null,
	);

	const titleRef = useRef<HTMLInputElement>(null);
	const categoryRef = useRef<HTMLInputElement>(null);
	const conditionRef = useRef<HTMLSelectElement>(null);
	const descriptionRef = useRef<HTMLTextAreaElement>(null);
	const wantedItemRef = useRef<HTMLInputElement>(null);
	const availableFromRef = useRef<HTMLInputElement>(null);
	const availableThroughRef = useRef<HTMLInputElement>(null);
	const availabilityNotesRef = useRef<HTMLTextAreaElement>(null);
	const imageSectionRef = useRef<HTMLDivElement>(null);

	const detailRequest = useCallback(
		(signal: AbortSignal) => {
			if (!listingId) {
				return Promise.reject(
					new ApiError({
						status: 0,
						code: "VALIDATION_ERROR",
						message: "A listing id is required to edit a listing.",
					}),
				);
			}
			return apiRequest("listingGetById", {
				params: { id: listingId },
				signal,
			});
		},
		[listingId],
	);
	const { state: detailState, retry: retryDetail } = useApi(detailRequest, {
		enabled: isEditing && Boolean(user),
		dependencies: [listingId],
	});
	const loadedListing =
		detailState.status === "success" ? detailState.data.data : null;
	const activeListing = currentListing ?? loadedListing;
	const isOwner = activeListing?.owner.id === user?.id;
	const isActive = activeListing?.status === "active";
	const mutationsBlocked =
		!user ||
		user.isDemo ||
		(isEditing && (!activeListing || !isOwner || !isActive));
	const fieldsLockedAfterSave = Boolean(pendingUploadListingId);
	const controlsDisabled =
		mutationsBlocked ||
		isSubmitting ||
		Boolean(deletingImageId) ||
		fieldsLockedAfterSave;

	useEffect(() => {
		if (
			authState.status === "anonymous" ||
			(!user && authState.status !== "loading")
		) {
			const currentPath = `${location.pathname}${location.search}${location.hash}`;
			navigate(`/login?redirect=${encodeURIComponent(currentPath)}`, {
				replace: true,
			});
		}
	}, [authState.status, location, navigate, user]);

	useEffect(() => {
		if (!loadedListing) return;
		setCurrentListing(loadedListing);
		setForm(listingToForm(loadedListing));
		setExistingImages(asExistingImages(loadedListing.images));
		setPendingImages([]);
		setFormErrors({});
		setTopError(null);
		setImageError(undefined);
	}, [loadedListing]);

	const focusFirstError = useCallback((errors: FormErrors) => {
		const first = FORM_FIELD_ORDER.find((field) => errors[field]);
		window.requestAnimationFrame(() => {
			switch (first) {
				case "title":
					titleRef.current?.focus();
					break;
				case "category":
					categoryRef.current?.focus();
					break;
				case "condition":
					conditionRef.current?.focus();
					break;
				case "description":
					descriptionRef.current?.focus();
					break;
				case "wantedItem":
					wantedItemRef.current?.focus();
					break;
				case "availableFrom":
					availableFromRef.current?.focus();
					break;
				case "availableThrough":
					availableThroughRef.current?.focus();
					break;
				case "availabilityNotes":
					availabilityNotesRef.current?.focus();
					break;
				case "images":
					imageSectionRef.current?.focus();
					break;
			}
		});
	}, []);

	const updateForm = <Field extends keyof ListingEditorForm>(
		field: Field,
		value: ListingEditorForm[Field],
	) => {
		setForm((current) => ({ ...current, [field]: value }));
		setFormErrors((current) => {
			if (!current[field]) return current;
			const { [field]: _, ...remaining } = current;
			return remaining;
		});
		setTopError(null);
	};

	const updateAvailability = (
		field: keyof AvailabilityValues,
		value: string,
	) => {
		updateForm(field, value);
	};

	const updateImages = (images: PendingListingImage[]) => {
		setPendingImages(images);
		setImageError(undefined);
		setFormErrors((current) => {
			if (!current.images) return current;
			const { images: _, ...remaining } = current;
			return remaining;
		});
	};

	const markImageUploadFailed = (message: string) => {
		setPendingImages((images) =>
			images.map((image) => ({ ...image, status: "error", error: message })),
		);
		setImageError(message);
		setTopError(message);
	};

	const uploadPendingImages = async (targetListingId: string) => {
		if (pendingImages.length === 0) {
			navigate(`/listings/${targetListingId}`);
			return true;
		}

		setIsSubmitting(true);
		setImageError(undefined);
		setPendingImages((images) =>
			images.map((image) => ({
				...image,
				status: "uploading",
				error: undefined,
			})),
		);
		try {
			const uploaded = await apiRequest("listingAddImages", {
				params: { id: targetListingId },
				body: {
					images: pendingImages.map((image) => image.file),
					metadata: pendingImages.map((image, sortOrder) => ({
						altText: image.altText.trim(),
						sortOrder,
					})),
				},
			});
			setExistingImages(asExistingImages(uploaded.data));
			setPendingImages([]);
			setPendingUploadListingId(null);
			navigate(`/listings/${targetListingId}`);
			return true;
		} catch (error) {
			const message = errorMessage(
				error,
				"The listing was saved, but its photos could not be uploaded.",
			);
			setPendingUploadListingId(targetListingId);
			markImageUploadFailed(message);
			return false;
		} finally {
			setIsSubmitting(false);
		}
	};

	const validateForm = (): FormErrors => {
		const errors: FormErrors = {};
		const parsed = CreateListingInputSchema.safeParse(buildCreateInput());
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				const field = issue.path[0] as FormField | undefined;
				if (field && !errors[field]) errors[field] = issue.message;
			}
		}
		isAvailabilityValid(form, errors);

		const missingAltImage = pendingImages.find(
			(image) => !image.altText.trim(),
		);
		if (missingAltImage) {
			errors.images =
				"Give every queued image a short description before publishing.";
			setPendingImages((images) =>
				images.map((image) =>
					image.id === missingAltImage.id
						? { ...image, error: "Image descriptions are required." }
						: image,
				),
			);
		}
		return errors;
	};

	const buildCreateInput = (): ApiRequestBody<"listingCreate"> => {
		const common = {
			title: form.title.trim(),
			description: form.description.trim(),
			category: form.category.trim(),
			condition: form.condition,
			availableFrom: form.availableFrom,
			availableThrough: form.availableThrough,
			...(form.availabilityNotes.trim()
				? { availabilityNotes: form.availabilityNotes.trim() }
				: {}),
		};
		return form.type === "lend"
			? { ...common, type: "lend" }
			: { ...common, type: form.type, wantedItem: form.wantedItem.trim() };
	};

	const buildPatchInput = (
		listing: ListingDetail,
	): ApiRequestBody<"listingPatch"> => {
		const patch: Record<string, string | null> = {};
		const nextTitle = form.title.trim();
		const nextCategory = form.category.trim();
		const nextDescription = form.description.trim();
		const nextWantedItem = form.wantedItem.trim();
		const nextNotes = form.availabilityNotes.trim();
		if (nextTitle !== listing.title) patch.title = nextTitle;
		if (nextCategory !== listing.category) patch.category = nextCategory;
		if (nextDescription !== listing.description)
			patch.description = nextDescription;
		if (form.condition !== listing.condition) patch.condition = form.condition;
		if (form.availableFrom !== listing.availableFrom) {
			patch.availableFrom = form.availableFrom;
		}
		if (form.availableThrough !== listing.availableThrough) {
			patch.availableThrough = form.availableThrough;
		}
		if (nextNotes !== (listing.availabilityNotes ?? "")) {
			patch.availabilityNotes = nextNotes || null;
		}
		if (
			listing.type !== "lend" &&
			nextWantedItem !== (listing.wantedItem ?? "")
		) {
			patch.wantedItem = nextWantedItem;
		}
		return patch as ApiRequestBody<"listingPatch">;
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (
			isSubmitting ||
			Boolean(deletingImageId) ||
			mutationsBlocked ||
			fieldsLockedAfterSave
		)
			return;

		setTopError(null);
		setImageError(undefined);
		const errors = validateForm();
		if (Object.keys(errors).length > 0) {
			setFormErrors(errors);
			focusFirstError(errors);
			return;
		}

		if (isEditing && activeListing) {
			const patch = buildPatchInput(activeListing);
			const parsedPatch = ListingPatchFieldsSchema.safeParse(patch);
			if (!parsedPatch.success && pendingImages.length === 0) {
				const noChangeError = {
					_form: "Make a change before saving this listing.",
				};
				setFormErrors(noChangeError);
				focusFirstError(noChangeError);
				return;
			}
			setIsSubmitting(true);
			try {
				let savedListing = activeListing;
				if (parsedPatch.success) {
					const response = await apiRequest("listingPatch", {
						params: { id: activeListing.id },
						body: parsedPatch.data,
					});
					savedListing = response.data;
					setCurrentListing(response.data);
					setExistingImages(asExistingImages(response.data.images));
				}
				setIsSubmitting(false);
				await uploadPendingImages(savedListing.id);
			} catch (error) {
				const message = errorMessage(
					error,
					"We could not save your listing. Please try again.",
				);
				setTopError(message);
				if (error instanceof ApiError && error.fields) {
					const fieldErrors: FormErrors = {};
					for (const [field, value] of Object.entries(error.fields)) {
						if (typeof value === "string") {
							fieldErrors[field as FormField] = value;
						} else if (Array.isArray(value) && typeof value[0] === "string") {
							fieldErrors[field as FormField] = value[0];
						}
					}
					setFormErrors(fieldErrors);
					focusFirstError(fieldErrors);
				}
				setIsSubmitting(false);
			}
			return;
		}

		setIsSubmitting(true);
		try {
			const created = await apiRequest("listingCreate", {
				body: buildCreateInput(),
			});
			setCurrentListing(created.data);
			setPendingUploadListingId(created.data.id);
			setIsSubmitting(false);
			await uploadPendingImages(created.data.id);
		} catch (error) {
			setTopError(
				errorMessage(
					error,
					"We could not publish your listing. Please try again.",
				),
			);
			if (error instanceof ApiError && error.fields) {
				const fieldErrors: FormErrors = {};
				for (const [field, value] of Object.entries(error.fields)) {
					if (typeof value === "string") {
						fieldErrors[field as FormField] = value;
					} else if (Array.isArray(value) && typeof value[0] === "string") {
						fieldErrors[field as FormField] = value[0];
					}
				}
				setFormErrors(fieldErrors);
				focusFirstError(fieldErrors);
			}
			setIsSubmitting(false);
		}
	};

	const handleDeleteExistingImage = async (image: ExistingListingImage) => {
		if (
			!activeListing ||
			isSubmitting ||
			Boolean(deletingImageId) ||
			mutationsBlocked
		)
			return;
		setDeletingImageId(image.id);
		setTopError(null);
		try {
			await apiRequest("listingDeleteImage", {
				params: { id: activeListing.id, imageId: image.id },
			});
			setExistingImages((images) =>
				images
					.filter((entry) => entry.id !== image.id)
					.map((entry, sortOrder) => ({ ...entry, sortOrder })),
			);
		} catch (error) {
			setTopError(
				errorMessage(
					error,
					"We could not remove that photo. Please try again.",
				),
			);
		} finally {
			setDeletingImageId(null);
		}
	};

	const summaryTitle = form.title.trim() || "Untitled listing";
	const summaryDates =
		form.availableFrom && form.availableThrough
			? `${form.availableFrom} to ${form.availableThrough}`
			: "Add an availability period";
	const summaryPhotoCount = existingImages.length + pendingImages.length;
	const detailError =
		detailState.status === "error" || detailState.status === "offline"
			? detailState.error
			: null;
	const authError =
		authState.status === "error" || authState.status === "offline"
			? authState.error
			: null;

	if (authState.status === "loading") {
		return (
			<main className={styles.statePage} aria-busy="true">
				<Spinner size="lg" ariaLabel="Loading your session" />
				<p>Loading your session…</p>
			</main>
		);
	}

	if (!user) {
		return (
			<main className={styles.statePage}>
				{authError ? (
					<InlineAlert
						variant="error"
						title="We could not confirm your session"
						action={
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => void retrySession()}
							>
								Try again
							</Button>
						}
					>
						{authError.message}
					</InlineAlert>
				) : (
					<Spinner ariaLabel="Opening sign in" />
				)}
			</main>
		);
	}

	if (isEditing && detailState.status === "loading") {
		return (
			<main className={styles.statePage} aria-busy="true">
				<Spinner size="lg" ariaLabel="Loading listing" />
				<p>Loading listing details…</p>
			</main>
		);
	}

	if (isEditing && detailError) {
		return (
			<main className={styles.statePage}>
				<InlineAlert
					variant="error"
					title="We could not load this listing"
					action={
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={retryDetail}
						>
							Try again
						</Button>
					}
				>
					{detailError.message}
				</InlineAlert>
			</main>
		);
	}

	if (isEditing && activeListing && !isOwner) {
		return (
			<main className={styles.statePage}>
				<InlineAlert variant="error" title="This listing is not yours to edit">
					Only the owner can change this listing.
				</InlineAlert>
			</main>
		);
	}

	return (
		<main className={styles.page}>
			<div className={styles.intro}>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={isSubmitting || Boolean(deletingImageId)}
					onClick={() =>
						navigate(
							isEditing && activeListing
								? `/listings/${activeListing.id}`
								: "/feed",
						)
					}
				>
					Back
				</Button>
				<div>
					<p className={styles.eyebrow}>
						{isEditing ? "Manage listing" : "Share locally"}
					</p>
					<h1>{isEditing ? "Edit your listing" : "Post a listing"}</h1>
					<p className={styles.lede}>
						{isEditing
							? "Keep the details current so neighbors can make a clear request."
							: "Describe what you can share or what you need. You will review the result on the next screen."}
					</p>
				</div>
			</div>

			{user.isDemo && (
				<InlineAlert variant="warning" title="Read-only demo account">
					Demo accounts can browse listings but cannot create, edit, upload, or
					remove them.
				</InlineAlert>
			)}
			{isEditing && activeListing && !isActive && (
				<InlineAlert variant="warning" title="This listing cannot be edited">
					Only active listings can receive substantive changes or image updates.
					Its current status is {activeListing.status}.
				</InlineAlert>
			)}
			{pendingUploadListingId && (
				<InlineAlert
					variant="warning"
					title="Your listing was saved, but photos still need to upload"
					action={
						<Button
							type="button"
							variant="outline"
							size="sm"
							leftIcon={
								<ArrowClockwise size={17} weight="bold" aria-hidden="true" />
							}
							disabled={
								isSubmitting || Boolean(deletingImageId) || mutationsBlocked
							}
							onClick={() => void uploadPendingImages(pendingUploadListingId)}
						>
							Retry photos
						</Button>
					}
				>
					Retry the multipart upload, or continue without these queued photos.
				</InlineAlert>
			)}
			{topError && !pendingUploadListingId && (
				<InlineAlert variant="error" title="Your listing was not saved">
					{topError}
				</InlineAlert>
			)}

			<div className={styles.layout}>
				<form
					className={styles.formSurface}
					onSubmit={handleSubmit}
					noValidate
					aria-busy={isSubmitting}
				>
					{Object.keys(formErrors).length > 0 && (
						<section
							className={styles.errorSummary}
							aria-labelledby="listing-error-summary"
							role="alert"
						>
							<h2 id="listing-error-summary">Check the highlighted fields</h2>
							<ul>
								{FORM_FIELD_ORDER.filter((field) => formErrors[field]).map(
									(field) => (
										<li key={field}>
											<strong>{FIELD_LABELS[field]}:</strong>{" "}
											{formErrors[field]}
										</li>
									),
								)}
							</ul>
						</section>
					)}

					<fieldset className={styles.section} disabled={controlsDisabled}>
						<legend>What are you posting?</legend>
						<p className={styles.sectionHelp}>
							Choose one exchange type. It cannot be changed after you publish.
						</p>
						<div className={styles.segmented}>
							{(Object.keys(TYPE_COPY) as ListingType[]).map((type) => (
								<label key={type} className={styles.typeOption}>
									<input
										type="radio"
										name="listingType"
										value={type}
										checked={form.type === type}
										disabled={controlsDisabled || isEditing}
										onChange={() => updateForm("type", type)}
									/>
									<span>
										<strong>{TYPE_COPY[type].label}</strong>
										<small>{TYPE_COPY[type].description}</small>
									</span>
								</label>
							))}
						</div>
					</fieldset>

					<section
						className={styles.section}
						aria-labelledby="listing-details-heading"
					>
						<h2 id="listing-details-heading">Listing details</h2>
						<p className={styles.sectionHelp}>
							Clear details help neighbors understand the exchange before they
							reach out.
						</p>
						<div className={styles.fieldGrid}>
							<TextField
								ref={titleRef}
								id="listing-title"
								name="title"
								label="Title"
								value={form.title}
								onChange={(event) => updateForm("title", event.target.value)}
								placeholder="For example, cordless drill"
								helpText="4 to 120 characters."
								minLength={4}
								maxLength={120}
								required
								disabled={controlsDisabled}
								error={formErrors.title}
							/>
							<TextField
								ref={categoryRef}
								id="listing-category"
								name="category"
								label="Category"
								value={form.category}
								onChange={(event) => updateForm("category", event.target.value)}
								placeholder="For example, tools"
								helpText="2 to 60 characters."
								minLength={2}
								maxLength={60}
								required
								disabled={controlsDisabled}
								error={formErrors.category}
							/>
							<Select
								ref={conditionRef}
								id="listing-condition"
								name="condition"
								label="Condition"
								value={form.condition}
								onChange={(event) =>
									updateForm(
										"condition",
										event.target.value as ListingCondition,
									)
								}
								options={CONDITION_OPTIONS}
								helpText="Choose the condition neighbors will see."
								required
								disabled={controlsDisabled}
								error={formErrors.condition}
							/>
							<div className={styles.fullWidth}>
								<TextArea
									ref={descriptionRef}
									id="listing-description"
									name="description"
									label="Description"
									value={form.description}
									onChange={(event) =>
										updateForm("description", event.target.value)
									}
									placeholder="Describe the item, its condition, and what a neighbor should know."
									helpText="10 to 2,500 characters."
									minLength={10}
									maxLength={2500}
									required
									disabled={controlsDisabled}
									error={formErrors.description}
								/>
							</div>
							{form.type !== "lend" && (
								<div className={styles.fullWidth}>
									<TextField
										ref={wantedItemRef}
										id="listing-wanted-item"
										name="wantedItem"
										label="What item do you want?"
										value={form.wantedItem}
										onChange={(event) =>
											updateForm("wantedItem", event.target.value)
										}
										placeholder={
											form.type === "borrow"
												? "For example, a ladder"
												: "For example, a hand truck"
										}
										helpText="Required for borrow and trade listings. 2 to 140 characters."
										minLength={2}
										maxLength={140}
										required
										disabled={controlsDisabled}
										error={formErrors.wantedItem}
									/>
								</div>
							)}
						</div>
					</section>

					<div className={styles.section}>
						<AvailabilityFields
							values={form}
							onChange={updateAvailability}
							errors={{
								availableFrom: formErrors.availableFrom,
								availableThrough: formErrors.availableThrough,
								availabilityNotes: formErrors.availabilityNotes,
							}}
							required
							disabled={controlsDisabled}
							fromRef={availableFromRef}
							throughRef={availableThroughRef}
							notesRef={availabilityNotesRef}
						/>
					</div>

					<div ref={imageSectionRef} className={styles.section} tabIndex={-1}>
						<ImageUploader
							images={pendingImages}
							existingImages={existingImages}
							disabled={controlsDisabled}
							retryDisabled={
								isSubmitting || Boolean(deletingImageId) || mutationsBlocked
							}
							deletingImageId={deletingImageId}
							error={imageError ?? formErrors.images}
							onChange={updateImages}
							onDeleteExisting={
								isEditing && isOwner && isActive
									? handleDeleteExistingImage
									: undefined
							}
							onRetry={
								pendingUploadListingId
									? () => void uploadPendingImages(pendingUploadListingId)
									: undefined
							}
						/>
					</div>

					<div className={styles.formActions}>
						{pendingUploadListingId ? (
							<>
								<Button
									type="button"
									variant="primary"
									isLoading={isSubmitting}
									disabled={mutationsBlocked}
									leftIcon={
										<ArrowClockwise
											size={18}
											weight="bold"
											aria-hidden="true"
										/>
									}
									onClick={() =>
										void uploadPendingImages(pendingUploadListingId)
									}
								>
									Retry photo upload
								</Button>
								<Button
									type="button"
									variant="tertiary"
									disabled={isSubmitting}
									onClick={() =>
										navigate(`/listings/${pendingUploadListingId}`)
									}
								>
									Continue without photos
								</Button>
							</>
						) : (
							<Button
								type="submit"
								variant="primary"
								isLoading={isSubmitting}
								disabled={mutationsBlocked}
								leftIcon={
									isEditing ? (
										<PencilSimple size={18} weight="bold" aria-hidden="true" />
									) : (
										<Plus size={18} weight="bold" aria-hidden="true" />
									)
								}
							>
								{isEditing ? "Save changes" : "Publish listing"}
							</Button>
						)}
						{isSubmitting && (
							<output className={styles.busyText}>
								<CircleNotch size={16} weight="bold" aria-hidden="true" />
								Saving your changes…
							</output>
						)}
					</div>
				</form>

				<aside className={styles.summary} aria-label="Listing summary">
					<div className={styles.summaryHeader}>
						<ImageSquare size={20} weight="duotone" aria-hidden="true" />
						<h2>Live summary</h2>
					</div>
					<Badge variant="primary">{TYPE_COPY[form.type].label}</Badge>
					<h3>{summaryTitle}</h3>
					<dl>
						<div>
							<dt>Category</dt>
							<dd>{form.category.trim() || "Add a category"}</dd>
						</div>
						<div>
							<dt>Condition</dt>
							<dd>
								{
									CONDITION_OPTIONS.find(
										(option) => option.value === form.condition,
									)?.label
								}
							</dd>
						</div>
						<div>
							<dt>Availability</dt>
							<dd>{summaryDates}</dd>
						</div>
						{form.type !== "lend" && (
							<div>
								<dt>Wanted item</dt>
								<dd>{form.wantedItem.trim() || "Add the item you want"}</dd>
							</div>
						)}
						<div>
							<dt>Photos</dt>
							<dd>
								{summaryPhotoCount === 0
									? "No photos added"
									: `${summaryPhotoCount} photo${summaryPhotoCount === 1 ? "" : "s"} selected`}
							</dd>
						</div>
					</dl>
					<p className={styles.summaryNote}>
						{activeListing
							? `Status: ${activeListing.status}.`
							: "The listing will be active once the server accepts it."}
					</p>
				</aside>
			</div>
		</main>
	);
}
