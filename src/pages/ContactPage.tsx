import { EnvelopeSimple, PaperPlaneTilt } from "@phosphor-icons/react";
import { type FormEvent, useRef, useState } from "react";

import {
	Button,
	InlineAlert,
	TextArea,
	TextField,
} from "../components/ui/Primitives";
import { ApiError, apiRequest } from "../lib/api";
import { ContactInputSchema } from "../lib/contracts";
import styles from "./MarketingPages.module.css";

type ContactField = "name" | "email" | "message";
type ContactFieldErrors = Partial<Record<ContactField, string>>;
type SubmissionState =
	| { kind: "idle" }
	| { kind: "sending" }
	| { kind: "success" }
	| { kind: "error"; message: string };

function firstFieldError(
	fields: Record<string, unknown> | undefined,
	field: ContactField,
) {
	const value = fields?.[field];
	return Array.isArray(value) && typeof value[0] === "string"
		? value[0]
		: undefined;
}

export function ContactPage() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [honeypot, setHoneypot] = useState("");
	const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
	const [submission, setSubmission] = useState<SubmissionState>({
		kind: "idle",
	});
	const errorRef = useRef<HTMLDivElement>(null);

	const clearFieldError = (field: ContactField) => {
		setFieldErrors((current) => {
			if (!current[field]) return current;
			const next = { ...current };
			delete next[field];
			return next;
		});
		if (submission.kind === "error") {
			setSubmission({ kind: "idle" });
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const parsed = ContactInputSchema.safeParse({
			name,
			email,
			message,
			honeypot,
		});
		if (!parsed.success) {
			const nextErrors: ContactFieldErrors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0];
				if (
					typeof field === "string" &&
					(field === "name" || field === "email" || field === "message") &&
					!nextErrors[field]
				) {
					nextErrors[field] = issue.message;
				}
			}
			setFieldErrors(nextErrors);
			setSubmission({
				kind: "error",
				message: "Check the highlighted fields, then try again.",
			});
			requestAnimationFrame(() => errorRef.current?.focus());
			return;
		}

		setFieldErrors({});
		setSubmission({ kind: "sending" });
		try {
			await apiRequest("contact", { body: parsed.data });
			setName("");
			setEmail("");
			setMessage("");
			setHoneypot("");
			setSubmission({ kind: "success" });
		} catch (error) {
			const message =
				error instanceof ApiError
					? error.message
					: "We could not send your message. Please try again.";
			if (error instanceof ApiError) {
				setFieldErrors({
					name: firstFieldError(error.fields, "name"),
					email: firstFieldError(error.fields, "email"),
					message: firstFieldError(error.fields, "message"),
				});
			}
			setSubmission({ kind: "error", message });
			requestAnimationFrame(() => errorRef.current?.focus());
		}
	};

	return (
		<main className={styles.page}>
			<section
				className={styles.contactLayout}
				aria-labelledby="contact-heading"
			>
				<div className={styles.contactIntro}>
					<p className={styles.eyebrow}>Contact Neighborly</p>
					<h1 id="contact-heading">A clear note reaches the team best.</h1>
					<p>
						Questions about the rebuild, an issue you found, or an idea for a
						better exchange flow are all welcome.
					</p>
					<div className={styles.contactDetails}>
						<EnvelopeSimple size={22} weight="fill" aria-hidden="true" />
						<p>
							Your message is sent to the Neighborly contact route and
							acknowledged without exposing a contact-record ID.
						</p>
					</div>
				</div>

				<form className={styles.contactForm} onSubmit={handleSubmit} noValidate>
					<div className={styles.formHeading}>
						<h2>Send a message</h2>
						<p>Include enough detail for a useful reply.</p>
					</div>

					{submission.kind === "success" ? (
						<InlineAlert variant="success" title="Message received">
							Thanks for getting in touch. We have recorded your note and will
							review it.
						</InlineAlert>
					) : null}

					{submission.kind === "error" ? (
						<div ref={errorRef} tabIndex={-1}>
							<InlineAlert variant="error" title="Message not sent">
								{submission.message}
							</InlineAlert>
						</div>
					) : null}

					<TextField
						id="contact-name"
						name="name"
						label="Name"
						autoComplete="name"
						required
						maxLength={100}
						value={name}
						error={fieldErrors.name}
						disabled={submission.kind === "sending"}
						onChange={(event) => {
							setName(event.target.value);
							clearFieldError("name");
						}}
					/>
					<TextField
						id="contact-email"
						name="email"
						label="Email"
						type="email"
						autoComplete="email"
						required
						value={email}
						error={fieldErrors.email}
						disabled={submission.kind === "sending"}
						onChange={(event) => {
							setEmail(event.target.value);
							clearFieldError("email");
						}}
					/>
					<TextArea
						id="contact-message"
						name="message"
						label="Message"
						helpText="At least 10 characters."
						autoComplete="off"
						required
						minLength={10}
						maxLength={2000}
						rows={7}
						value={message}
						error={fieldErrors.message}
						disabled={submission.kind === "sending"}
						onChange={(event) => {
							setMessage(event.target.value);
							clearFieldError("message");
						}}
					/>
					<div className={styles.honeypot} aria-hidden="true">
						<label htmlFor="contact-company">Company</label>
						<input
							id="contact-company"
							name="company"
							tabIndex={-1}
							autoComplete="off"
							value={honeypot}
							onChange={(event) => setHoneypot(event.target.value)}
						/>
					</div>
					<Button
						type="submit"
						isLoading={submission.kind === "sending"}
						disabled={submission.kind === "sending"}
						rightIcon={<PaperPlaneTilt size={18} aria-hidden="true" />}
					>
						{submission.kind === "error" ? "Retry message" : "Send message"}
					</Button>
				</form>
			</section>
		</main>
	);
}
