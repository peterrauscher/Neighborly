import { BookmarkSimple, MagnifyingGlass, X } from "@phosphor-icons/react";

import type { ListingType } from "../lib/contracts";
import styles from "../pages/FeedPage.module.css";

export type FeedFiltersValue = {
	q: string;
	type: ListingType | "";
	category: string;
	saved: boolean;
	availableFrom: string;
	availableThrough: string;
};

export interface FeedFiltersProps {
	filters: FeedFiltersValue;
	categories: readonly string[];
	onChange: (filters: FeedFiltersValue) => void;
	onClear: () => void;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: ListingType | ""; label: string }> =
	[
		{ value: "", label: "All types" },
		{ value: "lend", label: "Lend" },
		{ value: "borrow", label: "Borrow" },
		{ value: "trade", label: "Trade" },
	];

export function FeedFilters({
	filters,
	categories,
	onChange,
	onClear,
}: FeedFiltersProps) {
	const categoryOptions =
		filters.category && !categories.includes(filters.category)
			? [filters.category, ...categories]
			: categories;
	const hasActiveFilters = Boolean(
		filters.q ||
			filters.type ||
			filters.category ||
			filters.saved ||
			filters.availableFrom ||
			filters.availableThrough,
	);
	const dateFeedback =
		filters.availableFrom && !filters.availableThrough
			? "Choose an end date to apply availability filtering."
			: filters.availableThrough && !filters.availableFrom
				? "Choose a start date to apply availability filtering."
				: filters.availableFrom > filters.availableThrough
					? "The end date must be on or after the start date."
					: "";

	return (
		<form
			className={styles.filters}
			onSubmit={(event) => event.preventDefault()}
		>
			<div className={styles.searchField}>
				<MagnifyingGlass size={18} aria-hidden="true" />
				<label className={styles.srOnly} htmlFor="feed-search">
					Search listings
				</label>
				<input
					id="feed-search"
					className={styles.searchInput}
					type="search"
					value={filters.q}
					onChange={(event) => onChange({ ...filters, q: event.target.value })}
					placeholder="Search nearby listings"
					autoComplete="off"
				/>
			</div>

			<div className={styles.filterScroller}>
				<fieldset className={styles.filterGroup}>
					<legend className={styles.srOnly}>Listing type</legend>
					{TYPE_OPTIONS.map((option) => (
						<button
							key={option.label}
							type="button"
							className={styles.filterChip}
							aria-pressed={filters.type === option.value}
							onClick={() => onChange({ ...filters, type: option.value })}
						>
							{option.label}
						</button>
					))}
				</fieldset>

				<label className={styles.categoryLabel} htmlFor="feed-category">
					Category
				</label>
				<select
					id="feed-category"
					className={styles.categorySelect}
					value={filters.category}
					onChange={(event) =>
						onChange({ ...filters, category: event.target.value })
					}
				>
					<option value="">All categories</option>
					{categoryOptions.map((category) => (
						<option key={category} value={category}>
							{category.replace(/\b\w/g, (character) =>
								character.toUpperCase(),
							)}
						</option>
					))}
				</select>

				<fieldset className={styles.dateGroup}>
					<legend className={styles.srOnly}>Availability dates</legend>
					<label className={styles.dateLabel} htmlFor="feed-available-from">
						From
					</label>
					<input
						id="feed-available-from"
						className={styles.dateInput}
						type="date"
						value={filters.availableFrom}
						onChange={(event) =>
							onChange({ ...filters, availableFrom: event.target.value })
						}
						aria-describedby={dateFeedback ? "feed-date-feedback" : undefined}
					/>
					<label className={styles.dateLabel} htmlFor="feed-available-through">
						To
					</label>
					<input
						id="feed-available-through"
						className={styles.dateInput}
						type="date"
						value={filters.availableThrough}
						onChange={(event) =>
							onChange({ ...filters, availableThrough: event.target.value })
						}
						aria-describedby={dateFeedback ? "feed-date-feedback" : undefined}
					/>
				</fieldset>

				<button
					type="button"
					className={styles.savedChip}
					aria-pressed={filters.saved}
					onClick={() => onChange({ ...filters, saved: !filters.saved })}
				>
					<BookmarkSimple
						size={16}
						weight={filters.saved ? "fill" : "regular"}
						aria-hidden="true"
					/>
					Saved
				</button>

				<button
					type="button"
					className={styles.clearButton}
					onClick={onClear}
					disabled={!hasActiveFilters}
				>
					<X size={15} aria-hidden="true" />
					Clear
				</button>
			</div>
			{dateFeedback && (
				<output id="feed-date-feedback" className={styles.dateFeedback}>
					{dateFeedback}
				</output>
			)}
		</form>
	);
}
