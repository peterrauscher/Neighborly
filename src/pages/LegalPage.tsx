import { Link } from "react-router-dom";

import styles from "./MarketingPages.module.css";

export type LegalPageMode = "privacy" | "terms";

type LegalPageProps = {
	mode: LegalPageMode;
};

type LegalSection = {
	heading: string;
	paragraphs: readonly string[];
};

const privacySections: readonly LegalSection[] = [
	{
		heading: "What Neighborly stores",
		paragraphs: [
			"Neighborly keeps the information needed to run an account, neighborhood membership, listings, requests, completed exchanges, reviews, and account settings. It stores application data in a local SQLite database rather than an external account database.",
			"Listing images are accepted only after the application checks and re-encodes them. Submitted metadata, including image location metadata, is removed during that process.",
		],
	},
	{
		heading: "Neighborhoods, addresses, and messages",
		paragraphs: [
			"You select a neighborhood, but Neighborly does not collect a precise street address for a profile or listing. Public previews expose only curated listing summaries.",
			"Request details and messages are participant-only: they are available to the listing owner and requester, not to other members or public-preview visitors.",
		],
	},
	{
		heading: "Cookies and sessions",
		paragraphs: [
			"Authentication uses a session cookie. The cookie is HttpOnly, SameSite=Lax, limited to the application path, and uses the Secure attribute in production. The application keeps only a hash of the session token in its database.",
			"The session cookie is used to keep a signed-in member authenticated. Neighborly does not use it for advertising or cross-site behavioral tracking.",
		],
	},
	{
		heading: "Contact messages and retention",
		paragraphs: [
			"A contact form submission contains its name, email, and message only for the contact route. Contact records stay server-only in local SQLite and are automatically deleted after 30 days.",
			"Completed exchanges, reviews, and withdrawal history can remain where the application needs them to preserve a consistent exchange record.",
		],
	},
	{
		heading: "Demo and account choices",
		paragraphs: [
			"The public demo signs in to an isolated, read-only account. It cannot create, edit, request, react, save, review, or send messages, and it does not expose private fixture threads.",
			"You can update your profile or change your password while signed in. Neighborly does not offer password-recovery email, so a password change requires an authenticated account and the current password.",
		],
	},
];

const termsSections: readonly LegalSection[] = [
	{
		heading: "What Neighborly is for",
		paragraphs: [
			"Neighborly is a neighborhood resource-sharing application for lending, borrowing, and trading underused items. It is not a payment service, shipping service, identity-document service, or precise-address verification service.",
			"Use clear and accurate listing details, dates, item condition, and request context. The application is designed to organize a local exchange, not to make a claim that any member, item, or handoff has been verified.",
		],
	},
	{
		heading: "Requests and handoffs",
		paragraphs: [
			"A request records the relevant dates or offered item according to whether the listing is for lending, borrowing, or trading. The listing owner decides whether to accept or decline a pending request.",
			"An accepted request reserves a listing and resolves competing pending requests. A request can then be cancelled or completed through the application’s defined exchange states. Keep practical handoff details within the participant-only request thread.",
		],
	},
	{
		heading: "Reviews and privacy boundaries",
		paragraphs: [
			"Each participant may leave one review only after a completed exchange. The rating and written review appear on the reviewee’s profile for signed-in members of the same neighborhood and remain tied to that exchange rather than a general claim of verification.",
			"Member listings are scoped to the selected neighborhood. Precise street addresses are not collected, and request messages are visible only to the two participants in an exchange.",
		],
	},
	{
		heading: "Accounts and the demo",
		paragraphs: [
			"The public demo is intentionally read-only. Demo accounts cannot mutate listings or interactions, and no private fixture messages are available through the demo.",
			"There is no password-recovery email flow. Signed-in members can change a password by providing their current password, which also revokes their other sessions.",
		],
	},
	{
		heading: "Contact",
		paragraphs: [
			"For a question about Neighborly or these terms, use the contact form. It posts a name, email, and message to the application’s contact route and receives an acknowledgement when the message is accepted.",
		],
	},
];

export function LegalPage({ mode }: LegalPageProps) {
	const isPrivacy = mode === "privacy";
	const sections = isPrivacy ? privacySections : termsSections;
	const title = isPrivacy ? "Privacy" : "Terms of use";
	const summary = isPrivacy
		? "How the local Neighborly rebuild handles account, exchange, image, session, and contact information."
		: "The boundaries for using Neighborly to make a clear neighborhood resource exchange.";

	return (
		<main className={styles.page}>
			<article className={styles.legalArticle} aria-labelledby="legal-heading">
				<header className={styles.legalHeader}>
					<p className={styles.eyebrow}>
						{isPrivacy ? "Privacy notice" : "Neighborly terms"}
					</p>
					<h1 id="legal-heading">{title}</h1>
					<p>{summary}</p>
				</header>

				<div className={styles.legalSections}>
					{sections.map((section, index) => {
						const headingId = `${mode}-section-${index + 1}`;
						return (
							<section key={section.heading} aria-labelledby={headingId}>
								<h2 id={headingId}>{section.heading}</h2>
								{section.paragraphs.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</section>
						);
					})}
				</div>

				<p className={styles.legalContact}>
					Need to get in touch? <Link to="/contact">Contact Neighborly</Link>.
				</p>
			</article>
		</main>
	);
}
