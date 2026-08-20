import type { ProfileExchangeHistoryItem } from "../lib/contracts";

import { Avatar } from "./ui/Primitives";

export type ReceivedExchangeReview = NonNullable<
	ProfileExchangeHistoryItem["review"]
>;

export interface ReviewListProps {
	reviews: readonly ReceivedExchangeReview[];
	reviewCount: number;
	aggregateRating: number | null;
	className?: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
});

function reviewSummary(reviewCount: number, aggregateRating: number | null) {
	if (reviewCount === 0) return "No reviews yet";
	if (aggregateRating === null) {
		return `${reviewCount} received ${reviewCount === 1 ? "review" : "reviews"}`;
	}
	return `${aggregateRating.toFixed(1)} out of 5 from ${reviewCount} received ${reviewCount === 1 ? "review" : "reviews"}`;
}

export function ReviewList({
	reviews,
	reviewCount,
	aggregateRating,
	className,
}: ReviewListProps) {
	const hasAggregate = reviewCount > 0 && aggregateRating !== null;

	return (
		<section
			className={className}
			aria-label="Reviews from completed exchanges"
		>
			<header>
				<h2>Reviews</h2>
				<p>{reviewSummary(reviewCount, aggregateRating)}</p>
				{hasAggregate ? (
					<p>
						<strong>{aggregateRating.toFixed(1)} / 5</strong> average rating
					</p>
				) : null}
			</header>

			{reviews.length > 0 ? (
				<ol>
					{reviews.map((review) => (
						<li data-review-item key={review.id}>
							<article>
								<header>
									<div data-reviewer>
										<Avatar
											alt={`${review.reviewer.name}'s avatar`}
											name={review.reviewer.name}
											size="sm"
											src={review.reviewer.avatarPath || undefined}
										/>
										<div>
											<strong>{review.reviewer.name}</strong>
											<span>@{review.reviewer.handle}</span>
										</div>
									</div>
									<div data-review-score>
										<strong>{review.rating} / 5</strong>
										<time dateTime={new Date(review.createdAt).toISOString()}>
											{dateFormatter.format(new Date(review.createdAt))}
										</time>
									</div>
								</header>
								<p>{review.body}</p>
							</article>
						</li>
					))}
				</ol>
			) : (
				<p>
					{reviewCount === 0
						? "No completed-exchange reviews yet."
						: "No received reviews appear in this loaded exchange history yet."}
				</p>
			)}
		</section>
	);
}
