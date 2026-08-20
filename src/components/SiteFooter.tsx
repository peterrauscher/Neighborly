import { ArrowSquareOut, Trophy } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

import styles from "./SiteShell.module.css";

export function SiteFooter() {
	return (
		<footer className={styles.siteFooter}>
			<div className={styles.footerInner}>
				<section
					className={styles.footerBrand}
					aria-labelledby="footer-brand-title"
				>
					<Link className={styles.footerLogo} to="/">
						<img alt="Neighborly" src="/images/logo-with-text.svg" />
					</Link>
					<h2 id="footer-brand-title">Share more, buy less.</h2>
					<p>
						Neighborly helps people borrow, lend, and trade useful things with
						neighbors nearby.
					</p>
					<p className={styles.awardCopy}>
						<Trophy aria-hidden="true" size={18} weight="fill" />
						<span>Atlas Madness 2023 Grand Prize Winner</span>
					</p>
				</section>

				<div className={styles.footerLinks}>
					<section aria-labelledby="footer-product-title">
						<h2 id="footer-product-title">Product</h2>
						<ul>
							<li>
								<Link to="/">About Neighborly</Link>
							</li>
							<li>
								<Link to="/feed">Explore the feed</Link>
							</li>
							<li>
								<Link to="/register">Join your neighborhood</Link>
							</li>
						</ul>
					</section>

					<section aria-labelledby="footer-story-title">
						<h2 id="footer-story-title">Story &amp; code</h2>
						<ul>
							<li>
								<a
									href="https://devpost.com/software/neighborly-42ghs1"
									rel="noreferrer"
									target="_blank"
								>
									Atlas Madness story
									<ArrowSquareOut aria-hidden="true" size={15} weight="bold" />
								</a>
							</li>
							<li>
								<a
									href="https://github.com/peterrauscher/Neighborly"
									rel="noreferrer"
									target="_blank"
								>
									Open source on GitHub
									<ArrowSquareOut aria-hidden="true" size={15} weight="bold" />
								</a>
							</li>
						</ul>
					</section>

					<section aria-labelledby="footer-support-title">
						<h2 id="footer-support-title">Support &amp; legal</h2>
						<ul>
							<li>
								<Link to="/contact">Contact</Link>
							</li>
							<li>
								<Link to="/privacy">Privacy</Link>
							</li>
							<li>
								<Link to="/terms">Terms</Link>
							</li>
						</ul>
					</section>
				</div>
			</div>
			<div className={styles.footerBottom}>
				<p>© 2026 Neighborly. Built for useful local exchange.</p>
				<p>Private by design. No ad scripts.</p>
			</div>
		</footer>
	);
}
