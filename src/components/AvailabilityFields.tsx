import { type CSSProperties, type RefObject, useId } from "react";

import { TextArea, TextField } from "./ui/Primitives";

export type AvailabilityValues = {
	availableFrom: string;
	availableThrough: string;
	availabilityNotes: string;
};

type AvailabilityFieldName = keyof AvailabilityValues;

type AvailabilityFieldsProps = {
	values: AvailabilityValues;
	errors?: Partial<Record<AvailabilityFieldName, string>>;
	required?: boolean;
	disabled?: boolean;
	fromRef?: RefObject<HTMLInputElement>;
	throughRef?: RefObject<HTMLInputElement>;
	notesRef?: RefObject<HTMLTextAreaElement>;
	onChange: (field: AvailabilityFieldName, value: string) => void;
};

/** A date-only availability interval with a matched pair and optional context. */
export function AvailabilityFields({
	values,
	errors = {},
	required = false,
	disabled = false,
	fromRef,
	throughRef,
	notesRef,
	onChange,
}: AvailabilityFieldsProps) {
	const id = useId();
	const pairHelp = required
		? "Both dates are required. Dates are checked in your neighborhood's local timezone."
		: "Optional. If you provide one date, provide the other too. Dates are checked in your neighborhood's local timezone.";

	return (
		<section aria-labelledby={`${id}-heading`}>
			<h2 id={`${id}-heading`} style={sectionHeadingStyle}>
				Availability
			</h2>
			<p style={sectionHelpStyle}>{pairHelp}</p>
			<div style={fieldGridStyle}>
				<TextField
					ref={fromRef}
					id={`${id}-from`}
					name="availableFrom"
					type="date"
					label="Available from"
					value={values.availableFrom}
					onChange={(event) => onChange("availableFrom", event.target.value)}
					required={required}
					disabled={disabled}
					error={errors.availableFrom}
				/>
				<TextField
					ref={throughRef}
					id={`${id}-through`}
					name="availableThrough"
					type="date"
					label="Available through"
					value={values.availableThrough}
					min={values.availableFrom || undefined}
					onChange={(event) => onChange("availableThrough", event.target.value)}
					required={required}
					disabled={disabled}
					error={errors.availableThrough}
				/>
			</div>
			<TextArea
				ref={notesRef}
				id={`${id}-notes`}
				name="availabilityNotes"
				label="Availability notes"
				value={values.availabilityNotes}
				onChange={(event) => onChange("availabilityNotes", event.target.value)}
				placeholder="Optional context, such as weekend pickup or flexible return times"
				helpText="Optional. Do not include an exact address."
				maxLength={400}
				disabled={disabled}
				error={errors.availabilityNotes}
			/>
		</section>
	);
}

const sectionHeadingStyle: CSSProperties = {
	margin: "0",
	color: "var(--color-ink-primary)",
	fontSize: "var(--text-lg)",
	fontWeight: "var(--font-weight-semibold)",
	letterSpacing: "-0.01em",
};

const sectionHelpStyle: CSSProperties = {
	margin: "var(--space-1) 0 var(--space-4)",
	color: "var(--color-ink-muted)",
	fontSize: "var(--text-sm)",
	lineHeight: "var(--leading-normal)",
};

const fieldGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
	gap: "var(--space-4)",
	marginBottom: "var(--space-4)",
};
