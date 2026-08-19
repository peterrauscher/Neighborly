import {
	CaretDown,
	CheckCircle,
	CircleNotch,
	FolderOpen,
	Info,
	User,
	WarningCircle,
	X,
	XCircle,
} from "@phosphor-icons/react";
import React, {
	type ButtonHTMLAttributes,
	type CSSProperties,
	type ElementType,
	type HTMLAttributes,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
	forwardRef,
	useId,
	useState,
} from "react";
import styles from "./Primitives.module.css";

/* ==========================================================================
   BUTTON PRIMITIVE
   ========================================================================== */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?:
		| "primary"
		| "secondary"
		| "tertiary"
		| "ghost"
		| "destructive"
		| "outline";
	size?: "sm" | "md" | "lg";
	isLoading?: boolean;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			children,
			variant = "primary",
			size = "md",
			isLoading = false,
			leftIcon,
			rightIcon,
			fullWidth = false,
			disabled,
			className,
			type = "button",
			onClick,
			...props
		},
		ref,
	) => {
		const isGhost = variant === "ghost" || variant === "tertiary";
		const variantClass = isGhost
			? styles.buttonGhost
			: variant === "secondary"
				? styles.buttonSecondary
				: variant === "destructive"
					? styles.buttonDestructive
					: variant === "outline"
						? styles.buttonOutline
						: styles.buttonPrimary;

		const sizeClass =
			size === "sm"
				? styles.buttonSm
				: size === "lg"
					? styles.buttonLg
					: styles.buttonMd;

		const classNames = [
			styles.button,
			variantClass,
			sizeClass,
			fullWidth ? styles.buttonFullWidth : "",
			disabled ? styles.buttonDisabled : "",
			isLoading ? styles.buttonLoading : "",
			className || "",
		]
			.filter(Boolean)
			.join(" ");

		const isDisabled = disabled || isLoading;

		return (
			<button
				ref={ref}
				type={type}
				className={classNames}
				disabled={isDisabled}
				aria-disabled={isDisabled}
				onClick={isDisabled ? (e) => e.preventDefault() : onClick}
				{...props}
			>
				{isLoading ? (
					<Spinner size={size === "lg" ? "md" : "sm"} color="currentColor" />
				) : (
					leftIcon
				)}
				{children && <span>{children}</span>}
				{!isLoading && rightIcon}
			</button>
		);
	},
);
Button.displayName = "Button";

/* ==========================================================================
   TEXT FIELD PRIMITIVE
   ========================================================================== */

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: ReactNode;
	error?: string;
	helpText?: string;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	required?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
	(
		{
			label,
			error,
			helpText,
			leftIcon,
			rightIcon,
			required,
			id: customId,
			className,
			disabled,
			"aria-describedby": ariaDescribedBy,
			...props
		},
		ref,
	) => {
		const autoId = useId();
		const inputId = customId || autoId;
		const helpId = helpText ? `${inputId}-help` : undefined;
		const errorId = error ? `${inputId}-error` : undefined;

		const describedByParts = [ariaDescribedBy, helpId, errorId]
			.filter(Boolean)
			.join(" ");

		const inputClasses = [
			styles.input,
			leftIcon ? styles.inputHasLeftIcon : "",
			rightIcon ? styles.inputHasRightIcon : "",
			error ? styles.inputError : "",
			className || "",
		]
			.filter(Boolean)
			.join(" ");

		return (
			<div className={styles.fieldGroup}>
				{label && (
					<div className={styles.labelRow}>
						<label htmlFor={inputId} className={styles.label}>
							{label}
							{required && (
								<span className={styles.requiredAsterisk} aria-hidden="true">
									*
								</span>
							)}
						</label>
					</div>
				)}
				<div className={styles.inputWrapper}>
					{leftIcon && <div className={styles.inputIconLeft}>{leftIcon}</div>}
					<input
						ref={ref}
						id={inputId}
						className={inputClasses}
						disabled={disabled}
						aria-invalid={Boolean(error)}
						aria-required={required}
						aria-describedby={describedByParts || undefined}
						{...props}
					/>
					{rightIcon && (
						<div className={styles.inputIconRight}>{rightIcon}</div>
					)}
				</div>
				{helpText && (
					<p id={helpId} className={styles.helpText}>
						{helpText}
					</p>
				)}
				{error && (
					<p id={errorId} className={styles.errorText} role="alert">
						<WarningCircle size={14} weight="bold" aria-hidden="true" />
						<span>{error}</span>
					</p>
				)}
			</div>
		);
	},
);
TextField.displayName = "TextField";

/* ==========================================================================
   TEXT AREA PRIMITIVE
   ========================================================================== */

export interface TextAreaProps
	extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: ReactNode;
	error?: string;
	helpText?: string;
	required?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
	(
		{
			label,
			error,
			helpText,
			required,
			id: customId,
			className,
			disabled,
			rows = 4,
			"aria-describedby": ariaDescribedBy,
			...props
		},
		ref,
	) => {
		const autoId = useId();
		const textareaId = customId || autoId;
		const helpId = helpText ? `${textareaId}-help` : undefined;
		const errorId = error ? `${textareaId}-error` : undefined;

		const describedByParts = [ariaDescribedBy, helpId, errorId]
			.filter(Boolean)
			.join(" ");

		const textareaClasses = [
			styles.textarea,
			error ? styles.textareaError : "",
			className || "",
		]
			.filter(Boolean)
			.join(" ");

		return (
			<div className={styles.fieldGroup}>
				{label && (
					<div className={styles.labelRow}>
						<label htmlFor={textareaId} className={styles.label}>
							{label}
							{required && (
								<span className={styles.requiredAsterisk} aria-hidden="true">
									*
								</span>
							)}
						</label>
					</div>
				)}
				<textarea
					ref={ref}
					id={textareaId}
					rows={rows}
					className={textareaClasses}
					disabled={disabled}
					aria-invalid={Boolean(error)}
					aria-required={required}
					aria-describedby={describedByParts || undefined}
					{...props}
				/>
				{helpText && (
					<p id={helpId} className={styles.helpText}>
						{helpText}
					</p>
				)}
				{error && (
					<p id={errorId} className={styles.errorText} role="alert">
						<WarningCircle size={14} weight="bold" aria-hidden="true" />
						<span>{error}</span>
					</p>
				)}
			</div>
		);
	},
);
TextArea.displayName = "TextArea";

/* ==========================================================================
   SELECT PRIMITIVE
   ========================================================================== */

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	label?: ReactNode;
	error?: string;
	helpText?: string;
	required?: boolean;
	options?: SelectOption[];
	placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
	(
		{
			label,
			error,
			helpText,
			required,
			options,
			placeholder,
			id: customId,
			className,
			disabled,
			children,
			"aria-describedby": ariaDescribedBy,
			...props
		},
		ref,
	) => {
		const autoId = useId();
		const selectId = customId || autoId;
		const helpId = helpText ? `${selectId}-help` : undefined;
		const errorId = error ? `${selectId}-error` : undefined;

		const describedByParts = [ariaDescribedBy, helpId, errorId]
			.filter(Boolean)
			.join(" ");

		const selectClasses = [
			styles.select,
			error ? styles.selectError : "",
			className || "",
		]
			.filter(Boolean)
			.join(" ");

		return (
			<div className={styles.fieldGroup}>
				{label && (
					<div className={styles.labelRow}>
						<label htmlFor={selectId} className={styles.label}>
							{label}
							{required && (
								<span className={styles.requiredAsterisk} aria-hidden="true">
									*
								</span>
							)}
						</label>
					</div>
				)}
				<div className={styles.selectWrapper}>
					<select
						ref={ref}
						id={selectId}
						className={selectClasses}
						disabled={disabled}
						aria-invalid={Boolean(error)}
						aria-required={required}
						aria-describedby={describedByParts || undefined}
						{...props}
					>
						{placeholder && (
							<option value="" disabled>
								{placeholder}
							</option>
						)}
						{options
							? options.map((opt) => (
									<option
										key={opt.value}
										value={opt.value}
										disabled={opt.disabled}
									>
										{opt.label}
									</option>
								))
							: children}
					</select>
					<div className={styles.selectCaret} aria-hidden="true">
						<CaretDown size={16} weight="bold" />
					</div>
				</div>
				{helpText && (
					<p id={helpId} className={styles.helpText}>
						{helpText}
					</p>
				)}
				{error && (
					<p id={errorId} className={styles.errorText} role="alert">
						<WarningCircle size={14} weight="bold" aria-hidden="true" />
						<span>{error}</span>
					</p>
				)}
			</div>
		);
	},
);
Select.displayName = "Select";

/* ==========================================================================
   BADGE PRIMITIVE
   ========================================================================== */

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?:
		| "default"
		| "primary"
		| "apricot"
		| "success"
		| "warning"
		| "error"
		| "destructive"
		| "neutral";
	size?: "sm" | "md";
	pill?: boolean;
	icon?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
	(
		{
			children,
			variant = "default",
			size = "sm",
			pill = false,
			icon,
			className,
			...props
		},
		ref,
	) => {
		const isDestructive = variant === "destructive" || variant === "error";
		const variantClass = isDestructive
			? styles.badgeError
			: variant === "primary"
				? styles.badgePrimary
				: variant === "apricot"
					? styles.badgeApricot
					: variant === "success"
						? styles.badgeSuccess
						: variant === "warning"
							? styles.badgeWarning
							: variant === "neutral"
								? styles.badgeNeutral
								: styles.badgeDefault;

		const sizeClass = size === "md" ? styles.badgeMd : styles.badgeSm;

		const classNames = [
			styles.badge,
			variantClass,
			sizeClass,
			pill ? styles.badgePill : "",
			className || "",
		]
			.filter(Boolean)
			.join(" ");

		return (
			<span ref={ref} className={classNames} {...props}>
				{icon}
				{children && <span>{children}</span>}
			</span>
		);
	},
);
Badge.displayName = "Badge";

/* ==========================================================================
   AVATAR PRIMITIVE
   ========================================================================== */

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
	src?: string;
	alt?: string;
	name?: string;
	size?: "sm" | "md" | "lg" | "xl";
}

function getInitials(name?: string): string {
	if (!name) return "";
	const parts = name.trim().split(/\s+/);
	if (parts.length === 0 || !parts[0]) return "";
	if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
	({ src, alt, name, size = "md", className, ...props }, ref) => {
		const [imageError, setImageError] = useState(false);

		const sizeClass =
			size === "sm"
				? styles.avatarSm
				: size === "lg"
					? styles.avatarLg
					: size === "xl"
						? styles.avatarXl
						: styles.avatarMd;

		const initials = getInitials(name);
		const hasImage = Boolean(src) && !imageError;

		return (
			<div
				ref={ref}
				className={[styles.avatar, sizeClass, className || ""].join(" ").trim()}
				title={name || alt}
				{...props}
			>
				{hasImage ? (
					<img
						src={src}
						alt={alt || name || "Avatar"}
						className={styles.avatarImage}
						onError={() => setImageError(true)}
					/>
				) : initials ? (
					<span>{initials}</span>
				) : (
					<User
						size={
							size === "sm" ? 16 : size === "lg" ? 24 : size === "xl" ? 32 : 20
						}
					/>
				)}
			</div>
		);
	},
);
Avatar.displayName = "Avatar";

/* ==========================================================================
   SPINNER PRIMITIVE
   ========================================================================== */

export interface SpinnerProps {
	size?: "sm" | "md" | "lg" | number;
	ariaLabel?: string;
	className?: string;
	color?: string;
}

export function Spinner({
	size = "md",
	ariaLabel = "Loading...",
	className,
	color,
}: SpinnerProps) {
	const pixelSize =
		typeof size === "number"
			? size
			: size === "sm"
				? 16
				: size === "lg"
					? 32
					: 24;

	return (
		<output
			className={[styles.spinner, className || ""].join(" ").trim()}
			style={{ color: color || "currentColor" }}
		>
			<CircleNotch size={pixelSize} weight="bold" />
			<span className={styles.visuallyHidden}>{ariaLabel}</span>
		</output>
	);
}

/* ==========================================================================
   SKELETON PRIMITIVE
   ========================================================================== */

export interface SkeletonProps {
	width?: string | number;
	height?: string | number;
	borderRadius?: string | number;
	variant?: "text" | "circular" | "rectangular";
	className?: string;
	style?: CSSProperties;
}

export function Skeleton({
	width,
	height,
	borderRadius,
	variant = "rectangular",
	className,
	style,
}: SkeletonProps) {
	const variantClass =
		variant === "circular"
			? styles.skeletonCircular
			: variant === "text"
				? styles.skeletonText
				: styles.skeletonRectangular;

	const inlineStyles: CSSProperties = {
		width: width !== undefined ? width : undefined,
		height: height !== undefined ? height : undefined,
		borderRadius: borderRadius !== undefined ? borderRadius : undefined,
		...style,
	};

	return (
		<span
			aria-hidden="true"
			className={[styles.skeleton, variantClass, className || ""]
				.join(" ")
				.trim()}
			style={inlineStyles}
		/>
	);
}

/* ==========================================================================
   INLINE ALERT PRIMITIVE
   ========================================================================== */

export interface InlineAlertProps {
	variant?: "info" | "success" | "warning" | "error";
	title?: string;
	children: ReactNode;
	onClose?: () => void;
	action?: ReactNode;
	className?: string;
}

export function InlineAlert({
	variant = "info",
	title,
	children,
	onClose,
	action,
	className,
}: InlineAlertProps) {
	const variantClass =
		variant === "success"
			? styles.alertSuccess
			: variant === "warning"
				? styles.alertWarning
				: variant === "error"
					? styles.alertError
					: styles.alertInfo;

	const IconComponent =
		variant === "success"
			? CheckCircle
			: variant === "warning"
				? WarningCircle
				: variant === "error"
					? XCircle
					: Info;

	return (
		<div
			role="alert"
			className={[styles.inlineAlert, variantClass, className || ""]
				.join(" ")
				.trim()}
		>
			<div className={styles.alertIcon}>
				<IconComponent size={20} weight="bold" aria-hidden="true" />
			</div>
			<div className={styles.alertContent}>
				{title && <div className={styles.alertTitle}>{title}</div>}
				<div className={styles.alertBody}>{children}</div>
				{action && <div className={styles.alertAction}>{action}</div>}
			</div>
			{onClose && (
				<button
					type="button"
					onClick={onClose}
					className={styles.alertClose}
					aria-label="Close alert"
				>
					<X size={16} weight="bold" />
				</button>
			)}
		</div>
	);
}

/* ==========================================================================
   EMPTY STATE PRIMITIVE
   ========================================================================== */

export interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div className={[styles.emptyState, className || ""].join(" ").trim()}>
			<div className={styles.emptyIconWrapper}>
				{icon || <FolderOpen size={28} weight="duotone" />}
			</div>
			<h3 className={styles.emptyTitle}>{title}</h3>
			{description && <p className={styles.emptyDescription}>{description}</p>}
			{action && <div className={styles.emptyAction}>{action}</div>}
		</div>
	);
}

/* ==========================================================================
   VISUALLY HIDDEN PRIMITIVE
   ========================================================================== */

export interface VisuallyHiddenProps {
	as?: ElementType;
	children: ReactNode;
	className?: string;
}

export function VisuallyHidden({
	as: Component = "span",
	children,
	className,
}: VisuallyHiddenProps) {
	return (
		<Component
			className={[styles.visuallyHidden, className || ""].join(" ").trim()}
		>
			{children}
		</Component>
	);
}
