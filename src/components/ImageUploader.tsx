import {
	ArrowClockwise,
	ArrowDown,
	ArrowUp,
	ImageSquare,
	Trash,
	UploadSimple,
} from "@phosphor-icons/react";
import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";

import {
	MAX_LISTING_IMAGE_BYTES,
	MAX_LISTING_IMAGE_COUNT,
	MAX_MULTIPART_BODY_BYTES,
} from "../lib/contracts";
import styles from "./ImageUploader.module.css";
import { Button, TextField } from "./ui/Primitives";

export type PendingListingImage = {
	id: string;
	file: File;
	previewUrl: string;
	altText: string;
	status: "ready" | "uploading" | "error";
	error?: string;
};

export type ExistingListingImage = {
	id: string;
	url: string;
	altText: string;
	sortOrder: number;
};

type ImageUploaderProps = {
	images: readonly PendingListingImage[];
	existingImages?: readonly ExistingListingImage[];
	disabled?: boolean;
	retryDisabled?: boolean;
	deletingImageId?: string | null;
	error?: string;
	onChange: (images: PendingListingImage[]) => void;
	onDeleteExisting?: (image: ExistingListingImage) => void;
	onRetry?: () => void;
};

const ALLOWED_IMAGE_TYPES: Record<string, true> = {
	"image/jpeg": true,
	"image/png": true,
	"image/webp": true,
};

const makeImageId = () =>
	globalThis.crypto?.randomUUID?.() ??
	`listing-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const previewUrlFor = (file: File) =>
	typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";

const initialAltText = (file: File, position: number) => {
	const nameWithoutExtension = file.name.replace(/\.[^.]+$/, "").trim();
	return nameWithoutExtension || `Listing image ${position}`;
};

const readableMegabytes = (bytes: number) =>
	`${(bytes / 1024 / 1024).toFixed(0)} MiB`;

/**
 * A controlled local-file queue. Files remain in browser memory until its parent
 * completes the contract-bound multipart request.
 */
export function ImageUploader({
	images,
	existingImages = [],
	disabled = false,
	retryDisabled = disabled,
	deletingImageId,
	error,
	onChange,
	onDeleteExisting,
	onRetry,
}: ImageUploaderProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const objectUrlsRef = useRef(new Set<string>());
	const [announcement, setAnnouncement] = useState("");
	const availableSlots = Math.max(
		0,
		MAX_LISTING_IMAGE_COUNT - existingImages.length - images.length,
	);

	useEffect(() => {
		return () => {
			for (const previewUrl of objectUrlsRef.current) {
				URL.revokeObjectURL(previewUrl);
			}
			objectUrlsRef.current.clear();
		};
	}, []);

	const updateAltText = (id: string, altText: string) => {
		onChange(
			images.map((image) =>
				image.id === id
					? { ...image, altText, status: "ready", error: undefined }
					: image,
			),
		);
	};

	const moveImage = (id: string, direction: -1 | 1) => {
		const index = images.findIndex((image) => image.id === id);
		const nextIndex = index + direction;
		if (index < 0 || nextIndex < 0 || nextIndex >= images.length) return;

		const next = [...images];
		const [moved] = next.splice(index, 1);
		if (!moved) return;
		next.splice(nextIndex, 0, moved);
		onChange(next);
		setAnnouncement(`Moved image ${index + 1} to position ${nextIndex + 1}.`);
	};

	const removeImage = (id: string) => {
		const image = images.find((entry) => entry.id === id);
		if (!image) return;
		if (image.previewUrl) {
			URL.revokeObjectURL(image.previewUrl);
			objectUrlsRef.current.delete(image.previewUrl);
		}
		onChange(images.filter((entry) => entry.id !== id));
		setAnnouncement("Image removed from the upload queue.");
	};

	const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
		const selected = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = "";
		if (selected.length === 0) return;

		const fileErrors: string[] = [];
		const remainingCapacity =
			MAX_LISTING_IMAGE_COUNT - existingImages.length - images.length;
		if (selected.length > remainingCapacity) {
			fileErrors.push(
				`You can add ${Math.max(remainingCapacity, 0)} more image${remainingCapacity === 1 ? "" : "s"}. A listing can have at most ${MAX_LISTING_IMAGE_COUNT}.`,
			);
		}

		const accepted: File[] = [];
		for (const file of selected.slice(0, Math.max(remainingCapacity, 0))) {
			if (!ALLOWED_IMAGE_TYPES[file.type]) {
				fileErrors.push(`${file.name}: choose a JPEG, PNG, or WebP image.`);
				continue;
			}
			if (file.size > MAX_LISTING_IMAGE_BYTES) {
				fileErrors.push(
					`${file.name}: images must be ${readableMegabytes(MAX_LISTING_IMAGE_BYTES)} or smaller.`,
				);
				continue;
			}
			accepted.push(file);
		}

		const totalBytes =
			images.reduce((total, image) => total + image.file.size, 0) +
			accepted.reduce((total, file) => total + file.size, 0);
		if (totalBytes > MAX_MULTIPART_BODY_BYTES) {
			fileErrors.push(
				`The selected images total more than ${readableMegabytes(MAX_MULTIPART_BODY_BYTES)} and cannot be uploaded together.`,
			);
			accepted.length = 0;
		}

		if (accepted.length > 0) {
			const nextImages = accepted.map((file, index) => {
				const previewUrl = previewUrlFor(file);
				if (previewUrl) objectUrlsRef.current.add(previewUrl);
				return {
					id: makeImageId(),
					file,
					previewUrl,
					altText: initialAltText(file, images.length + index + 1),
					status: "ready" as const,
				};
			});
			onChange([...images, ...nextImages]);
		}

		const message = fileErrors.length
			? `${fileErrors.join(" ")} ${accepted.length > 0 ? `${accepted.length} image${accepted.length === 1 ? " was" : "s were"} added.` : ""}`.trim()
			: `${accepted.length} image${accepted.length === 1 ? " was" : "s were"} added. Describe each image before you publish.`;
		setAnnouncement(message);
	};

	return (
		<section className={styles.uploader} aria-labelledby={`${inputId}-heading`}>
			<div className={styles.header}>
				<div>
					<h2 id={`${inputId}-heading`} className={styles.heading}>
						Photos
					</h2>
					<p className={styles.help}>
						Optional. Add up to {MAX_LISTING_IMAGE_COUNT} JPEG, PNG, or WebP
						images. Each may be up to{" "}
						{readableMegabytes(MAX_LISTING_IMAGE_BYTES)}; all uploaded files
						together may be up to {readableMegabytes(MAX_MULTIPART_BODY_BYTES)}.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					leftIcon={<UploadSimple size={17} weight="bold" aria-hidden="true" />}
					disabled={disabled || availableSlots === 0}
					onClick={() => inputRef.current?.click()}
				>
					Add photos
				</Button>
			</div>

			<input
				ref={inputRef}
				id={inputId}
				className={styles.fileInput}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				multiple
				disabled={disabled || availableSlots === 0}
				onChange={selectFiles}
			/>
			<p className={styles.capacity}>
				{existingImages.length + images.length} of {MAX_LISTING_IMAGE_COUNT}{" "}
				photo slots used
			</p>
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
			<div className={styles.liveRegion} aria-live="polite" aria-atomic="true">
				{announcement}
			</div>

			{existingImages.length > 0 && (
				<ol className={styles.imageList} aria-label="Current listing photos">
					{[...existingImages]
						.sort((left, right) => left.sortOrder - right.sortOrder)
						.map((image) => (
							<li key={image.id} className={styles.imageRow}>
								<img
									src={image.url}
									alt={image.altText}
									className={styles.preview}
								/>
								<div className={styles.imageDetails}>
									<p className={styles.imageName}>
										Current photo {image.sortOrder + 1}
									</p>
									<p className={styles.altPreview}>{image.altText}</p>
								</div>
								{onDeleteExisting && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										leftIcon={
											<Trash size={17} weight="bold" aria-hidden="true" />
										}
										disabled={disabled || deletingImageId === image.id}
										isLoading={deletingImageId === image.id}
										onClick={() => onDeleteExisting(image)}
									>
										Remove
									</Button>
								)}
							</li>
						))}
				</ol>
			)}

			{images.length > 0 && (
				<ol className={styles.imageList} aria-label="Queued listing photos">
					{images.map((image, index) => (
						<li key={image.id} className={styles.imageRow}>
							{image.previewUrl ? (
								<img
									src={image.previewUrl}
									alt={image.altText || `Preview for ${image.file.name}`}
									className={styles.preview}
								/>
							) : (
								<div className={styles.previewFallback} aria-hidden="true">
									<ImageSquare size={30} weight="duotone" />
								</div>
							)}
							<div className={styles.imageDetails}>
								<p className={styles.imageName}>
									Queued photo {index + 1}: {image.file.name}
								</p>
								<TextField
									id={`${inputId}-${image.id}-alt`}
									label="Image description"
									value={image.altText}
									onChange={(event) =>
										updateAltText(image.id, event.target.value)
									}
									placeholder="Describe what neighbors can see"
									maxLength={140}
									required
									disabled={disabled}
									error={image.error}
								/>
								{image.status === "uploading" && (
									<output className={styles.uploading}>Uploading photo…</output>
								)}
							</div>
							<div
								className={styles.actions}
								aria-label={`Controls for queued photo ${index + 1}`}
							>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label={`Move queued photo ${index + 1} earlier`}
									leftIcon={
										<ArrowUp size={17} weight="bold" aria-hidden="true" />
									}
									disabled={disabled || index === 0}
									onClick={() => moveImage(image.id, -1)}
								/>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label={`Move queued photo ${index + 1} later`}
									leftIcon={
										<ArrowDown size={17} weight="bold" aria-hidden="true" />
									}
									disabled={disabled || index === images.length - 1}
									onClick={() => moveImage(image.id, 1)}
								/>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label={`Remove queued photo ${index + 1}`}
									leftIcon={
										<Trash size={17} weight="bold" aria-hidden="true" />
									}
									disabled={disabled}
									onClick={() => removeImage(image.id)}
								/>
								{image.status === "error" && onRetry && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										leftIcon={
											<ArrowClockwise
												size={17}
												weight="bold"
												aria-hidden="true"
											/>
										}
										disabled={retryDisabled}
										onClick={onRetry}
									>
										Retry
									</Button>
								)}
							</div>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
