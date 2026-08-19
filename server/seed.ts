import type { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import type {
	ListingCondition,
	ListingType,
	RequestStatus,
} from "../src/lib/contracts";

type SeedNeighborhood = {
	id: string;
	slug: string;
	name: string;
	city: string;
	state: string;
	timezone: string;
	description: string;
	imagePath: string;
	createdAt: number;
	updatedAt: number;
};

type SeedUser = {
	id: string;
	email: string;
	password: string;
	name: string;
	handle: string;
	avatarPath: string;
	bio: string;
	neighborhoodId: string;
	isDemo: boolean;
	createdAt: number;
	updatedAt: number;
};

type SeedListing = {
	id: string;
	ownerId: string;
	neighborhoodId: string;
	type: ListingType;
	title: string;
	description: string;
	category: string;
	condition: ListingCondition;
	availableFrom: string;
	availableThrough: string;
	availabilityNotes?: string;
	wantedItem?: string;
	status: "active" | "reserved" | "completed" | "withdrawn";
	deletedAt?: number;
	deletedByUserId?: string;
	deletedReason?: string;
	createdAt: number;
	updatedAt: number;
};

type SeedRequest = {
	id: string;
	listingId: string;
	requesterId: string;
	requestedStart?: string;
	requestedEnd?: string;
	offeredTitle?: string;
	offeredDescription?: string;
	offeredCondition?: ListingCondition;
	openingMessage: string;
	status: RequestStatus;
	cancelledByUserId?: string;
	cancellationReason?: string;
	createdAt: number;
	updatedAt: number;
};

type SeedComment = {
	id: string;
	listingId: string;
	authorId: string;
	body: string;
	createdAt: number;
	updatedAt: number;
};

type SeedMessage = {
	id: string;
	requestId: string;
	senderId: string;
	body: string;
	createdAt: number;
	readAt?: number;
};

type SeedReview = {
	id: string;
	requestId: string;
	reviewerId: string;
	rating: number;
	body: string;
	createdAt: number;
};

type SeedListingImage = {
	id: string;
	listingId: string;
	asset: string;
	altText: string;
	sortOrder: number;
	createdAt: number;
};

export type SeedMode = "development" | "public-demo";

type SeedOptions = {
	mode?: SeedMode;
};

const baseNow = Date.UTC(2026, 7, 19);
const oneDayMs = 24 * 60 * 60 * 1000;

const ts = (offsetDays: number) => baseNow + offsetDays * oneDayMs;
const dateFromOffset = (offsetDays: number) =>
	new Date(ts(offsetDays)).toISOString().slice(0, 10);

const neighborhoodRows: SeedNeighborhood[] = [
	{
		id: "nh_oakridge_01",
		slug: "oakridge",
		name: "Oakridge Commons",
		city: "Austin",
		state: "TX",
		timezone: "America/Chicago",
		description:
			"A walkable in-town neighborhood with active block captains and shared maintenance tools.",
		imagePath: "/assets/neighborhood.png",
		createdAt: ts(-180),
		updatedAt: ts(-180),
	},
	{
		id: "nh_rivervale_02",
		slug: "rivervale",
		name: "Rivervale",
		city: "Denver",
		state: "CO",
		timezone: "America/Denver",
		description:
			"Mountain-edge streets with a practical culture around home repairs and car-caring sessions.",
		imagePath: "/assets/find-space.png",
		createdAt: ts(-170),
		updatedAt: ts(-170),
	},
	{
		id: "nh_pinecreek_03",
		slug: "pinecreek",
		name: "Pinecreek",
		city: "Portland",
		state: "OR",
		timezone: "America/Los_Angeles",
		description:
			"Gardens, family drives, and a cooperative neighbor culture centered on shared borrowing.",
		imagePath: "/assets/live-sustainably.png",
		createdAt: ts(-160),
		updatedAt: ts(-160),
	},
];

const userRows: SeedUser[] = [
	{
		id: "u_demo_001",
		email: "demo@neighborly.local",
		password: "DemoReadOnly!2026",
		name: "Demo Resident",
		handle: "demo_readonly",
		avatarPath: "/assets/logo.svg",
		bio: "Read-only demo principal for portfolio walkthroughs.",
		neighborhoodId: "nh_oakridge_01",
		isDemo: true,
		createdAt: ts(-150),
		updatedAt: ts(-150),
	},
	{
		id: "u_alma_002",
		email: "alma@neighborly.local",
		password: "AlmaHousework1!",
		name: "Alma Rivera",
		handle: "alma_rivera",
		avatarPath: "/assets/foster-community.png",
		bio: "I organize neighborhood tool circles and small exchange events.",
		neighborhoodId: "nh_oakridge_01",
		isDemo: false,
		createdAt: ts(-145),
		updatedAt: ts(-140),
	},
	{
		id: "u_ben_003",
		email: "ben@neighborly.local",
		password: "BenGardens4$",
		name: "Ben Tran",
		handle: "ben_tran",
		avatarPath: "/assets/save-money.png",
		bio: "DIY homeowner with a shared workshop and weekend fixes.",
		neighborhoodId: "nh_oakridge_01",
		isDemo: false,
		createdAt: ts(-142),
		updatedAt: ts(-130),
	},
	{
		id: "u_clara_004",
		email: "clara@neighborly.local",
		password: "ClaraLend#2026",
		name: "Clara Singh",
		avatarPath: "/assets/neighborhood.png",
		handle: "clara_s",
		bio: "I am a full-time student sharing gear to make moving easier.",
		neighborhoodId: "nh_rivervale_02",
		isDemo: false,
		createdAt: ts(-138),
		updatedAt: ts(-120),
	},
	{
		id: "u_derek_005",
		email: "derek@neighborly.local",
		password: "DerekBorrow!9",
		name: "Derek Kim",
		handle: "derek_kim",
		avatarPath: "/assets/save-money.png",
		bio: "Car + family life, always trading seasonal tools and helpers.",
		neighborhoodId: "nh_rivervale_02",
		isDemo: false,
		createdAt: ts(-135),
		updatedAt: ts(-110),
	},
	{
		id: "u_eli_006",
		email: "eli@neighborly.local",
		password: "EliTrade!88",
		name: "Elifor Keller",
		handle: "eli_keller",
		avatarPath: "/assets/logo-with-text.png",
		bio: "I keep a micro garden and lend garden maintenance tools.",
		neighborhoodId: "nh_pinecreek_03",
		isDemo: false,
		createdAt: ts(-130),
		updatedAt: ts(-101),
	},
	{
		id: "u_fiona_007",
		email: "fiona@neighborly.local",
		password: "FionaPlant$12",
		name: "Fiona Ortiz",
		handle: "fiona_ortiz",
		avatarPath: "/assets/foster-community.png",
		bio: "I share household and childcare items to keep moving easy.",
		neighborhoodId: "nh_pinecreek_03",
		isDemo: false,
		createdAt: ts(-122),
		updatedAt: ts(-100),
	},
];

export const LOCAL_FIXTURE_CREDENTIALS = Object.freeze(
	userRows.reduce<Record<string, string>>((acc, user) => {
		acc[user.email] = user.password;
		acc[user.handle] = user.password;
		return acc;
	}, {}),
);

const listingRows: SeedListing[] = [
	{
		id: "list_lend_001",
		ownerId: "u_alma_002",
		neighborhoodId: "nh_oakridge_01",
		type: "lend",
		title: "Cordless drill + bits",
		description:
			"Quiet electric drill set with bits, extension and charger for simple home repairs.",
		category: "tools",
		condition: "good",
		availableFrom: dateFromOffset(0),
		availableThrough: dateFromOffset(21),
		availabilityNotes: "Available in evenings and weekends.",
		status: "active",
		createdAt: ts(-90),
		updatedAt: ts(-90),
	},
	{
		id: "list_borrow_002",
		ownerId: "u_ben_003",
		neighborhoodId: "nh_oakridge_01",
		type: "borrow",
		title: "Looking for snow shovel",
		description: "Need a sturdy snow shovel for driveway clearing this month.",
		category: "seasonal",
		condition: "fair",
		availableFrom: dateFromOffset(2),
		availableThrough: dateFromOffset(18),
		wantedItem: "Collapsible shovel",
		status: "active",
		createdAt: ts(-82),
		updatedAt: ts(-80),
	},
	{
		id: "list_trade_003",
		ownerId: "u_clara_004",
		neighborhoodId: "nh_rivervale_02",
		type: "trade",
		title: "Trade bike helmet",
		description:
			"Looking to trade one helmet for a child-size helmet or bike light.",
		category: "sports",
		condition: "good",
		availableFrom: dateFromOffset(1),
		availableThrough: dateFromOffset(10),
		wantedItem: "Child-sized bike helmet or quality rear light",
		status: "active",
		createdAt: ts(-76),
		updatedAt: ts(-70),
	},
	{
		id: "list_lend_004",
		ownerId: "u_derek_005",
		neighborhoodId: "nh_rivervale_02",
		type: "lend",
		title: "Lawn aerator machine",
		description: "Gas-assisted aerator for deep spring aeration.",
		category: "gardening",
		condition: "like_new",
		availableFrom: dateFromOffset(3),
		availableThrough: dateFromOffset(25),
		status: "active",
		createdAt: ts(-70),
		updatedAt: ts(-62),
	},
	{
		id: "list_trade_005",
		ownerId: "u_eli_006",
		neighborhoodId: "nh_pinecreek_03",
		type: "trade",
		title: "Trade old espresso machine",
		description:
			"Small counter espresso machine in exchange for coffee grinder.",
		category: "kitchen",
		condition: "good",
		availableFrom: dateFromOffset(5),
		availableThrough: dateFromOffset(20),
		wantedItem: "Manual or electric coffee grinder",
		status: "reserved",
		createdAt: ts(-66),
		updatedAt: ts(-22),
	},
	{
		id: "list_lend_006",
		ownerId: "u_fiona_007",
		neighborhoodId: "nh_pinecreek_03",
		type: "lend",
		title: "Pop-up tent",
		description: "5-person pop-up tent with ground stakes and ground cloth.",
		category: "outdoor",
		condition: "good",
		availableFrom: dateFromOffset(7),
		availableThrough: dateFromOffset(28),
		availabilityNotes: "Bring own lights and cords.",
		status: "active",
		createdAt: ts(-64),
		updatedAt: ts(-55),
	},
	{
		id: "list_borrow_007",
		ownerId: "u_alma_002",
		neighborhoodId: "nh_oakridge_01",
		type: "borrow",
		title: "Need large roasting pan",
		description: "Borrow a 14-inch roasting pan for one weekend.",
		category: "kitchen",
		condition: "fair",
		availableFrom: dateFromOffset(8),
		availableThrough: dateFromOffset(14),
		wantedItem: "Aluminum roasting pan",
		status: "completed",
		createdAt: ts(-58),
		updatedAt: ts(-20),
	},
	{
		id: "list_trade_008",
		ownerId: "u_ben_003",
		neighborhoodId: "nh_oakridge_01",
		type: "trade",
		title: "Trade stand mixer",
		description:
			"Looking to trade a stand mixer for a bread proofing basket or Dutch oven.",
		category: "kitchen",
		condition: "fair",
		availableFrom: dateFromOffset(4),
		availableThrough: dateFromOffset(17),
		wantedItem: "Bread basket, Dutch oven, or heavy pot",
		status: "completed",
		createdAt: ts(-52),
		updatedAt: ts(-20),
	},
	{
		id: "list_lend_009",
		ownerId: "u_clara_004",
		neighborhoodId: "nh_rivervale_02",
		type: "lend",
		title: "Camping lantern set",
		description:
			"LED lantern with extra batteries for one-night outdoor events.",
		category: "outdoor",
		condition: "like_new",
		availableFrom: dateFromOffset(0),
		availableThrough: dateFromOffset(30),
		status: "withdrawn",
		deletedAt: ts(-10),
		deletedByUserId: "u_clara_004",
		deletedReason: "User requested to end listing after event was cancelled.",
		createdAt: ts(-48),
		updatedAt: ts(-10),
	},
	{
		id: "list_borrow_010",
		ownerId: "u_derek_005",
		neighborhoodId: "nh_rivervale_02",
		type: "borrow",
		title: "Borrow ladder",
		description: "Need a ladder for attic light fixture access this weekend.",
		category: "tools",
		condition: "good",
		availableFrom: dateFromOffset(12),
		availableThrough: dateFromOffset(17),
		wantedItem: "4-piece ladder with stabilizer",
		status: "active",
		createdAt: ts(-40),
		updatedAt: ts(-33),
	},
	{
		id: "list_trade_011",
		ownerId: "u_eli_006",
		neighborhoodId: "nh_pinecreek_03",
		type: "trade",
		title: "Trade bike chain set",
		description:
			"Trade one bike chain for speed free kit or high quality lubricant.",
		category: "sports",
		condition: "good",
		availableFrom: dateFromOffset(6),
		availableThrough: dateFromOffset(23),
		wantedItem: "Freewheel chainset or bike lubricant",
		status: "active",
		createdAt: ts(-36),
		updatedAt: ts(-30),
	},
	{
		id: "list_lend_012",
		ownerId: "u_fiona_007",
		neighborhoodId: "nh_pinecreek_03",
		type: "lend",
		title: "Compact blender",
		description:
			"Countertop blender ideal for smoothies and sauces, light use.",
		category: "kitchen",
		condition: "good",
		availableFrom: dateFromOffset(9),
		availableThrough: dateFromOffset(40),
		status: "active",
		createdAt: ts(-32),
		updatedAt: ts(-25),
	},
];

const requestRows: SeedRequest[] = [
	{
		id: "req_001",
		listingId: "list_lend_001",
		requesterId: "u_ben_003",
		requestedStart: dateFromOffset(3),
		requestedEnd: dateFromOffset(5),
		openingMessage:
			"Can I borrow this drill for a small furniture job on Saturday?",
		status: "pending",
		createdAt: ts(-8),
		updatedAt: ts(-8),
	},
	{
		id: "req_002",
		listingId: "list_trade_005",
		requesterId: "u_fiona_007",
		requestedStart: dateFromOffset(6),
		requestedEnd: dateFromOffset(11),
		offeredTitle: "Burr grinder",
		offeredDescription:
			"Manual burr grinder in excellent condition with storage can.",
		offeredCondition: "good",
		openingMessage:
			"I can trade a burr grinder and keep both if you want to include a grinder bag too.",
		status: "accepted",
		createdAt: ts(-35),
		updatedAt: ts(-30),
	},
	{
		id: "req_003",
		listingId: "list_borrow_007",
		requesterId: "u_ben_003",
		offeredTitle: "Aluminum roasting pan",
		offeredDescription:
			"Fourteen-inch aluminum roasting pan with a rack and sturdy handles.",
		offeredCondition: "good",
		openingMessage:
			"I need the pan for Sunday roasts, can return Sunday night.",
		status: "completed",
		createdAt: ts(-30),
		updatedAt: ts(-20),
	},
	{
		id: "req_004",
		listingId: "list_trade_008",
		requesterId: "u_alma_002",
		offeredTitle: "Cast-iron Dutch oven",
		offeredDescription:
			"10-inch cast-iron Dutch oven with lid, smooth interior.",
		offeredCondition: "fair",
		openingMessage: "I can swap for my Dutch oven and a dough proof tray.",
		status: "completed",
		createdAt: ts(-48),
		updatedAt: ts(-20),
	},
	{
		id: "req_005",
		listingId: "list_lend_012",
		requesterId: "u_eli_006",
		requestedStart: dateFromOffset(11),
		requestedEnd: dateFromOffset(12),
		openingMessage:
			"Could I borrow this blender for two smoothies while we cook dinner?",
		status: "cancelled",
		cancelledByUserId: "u_eli_006",
		cancellationReason: "Plans changed before pickup.",
		createdAt: ts(-16),
		updatedAt: ts(-12),
	},
	{
		id: "req_006",
		listingId: "list_trade_003",
		requesterId: "u_derek_005",
		offeredTitle: "Rear bike safety light",
		offeredDescription: "USB rechargeable rear light with magnet mount.",
		offeredCondition: "new",
		openingMessage:
			"I can swap this rear light for the helmet or include reflective gloves.",
		status: "declined",
		createdAt: ts(-14),
		updatedAt: ts(-11),
	},
];

const listingImageRows: SeedListingImage[] = [
	{
		id: "img_001",
		listingId: "list_lend_001",
		asset: "assets/save-money.png",
		altText: "Cordless drill on workbench",
		sortOrder: 0,
		createdAt: ts(-89),
	},
	{
		id: "img_002",
		listingId: "list_borrow_002",
		asset: "assets/find-space.png",
		altText: "Snow shovel and utility bag",
		sortOrder: 0,
		createdAt: ts(-81),
	},
	{
		id: "img_003",
		listingId: "list_trade_003",
		asset: "assets/live-sustainably.png",
		altText: "Bike helmet on kitchen table",
		sortOrder: 0,
		createdAt: ts(-75),
	},
	{
		id: "img_004",
		listingId: "list_lend_004",
		asset: "assets/foster-community.png",
		altText: "Lawn aerator with hoses",
		sortOrder: 0,
		createdAt: ts(-68),
	},
	{
		id: "img_005",
		listingId: "list_trade_005",
		asset: "assets/neighborhood.png",
		altText: "Espresso machine on shelf",
		sortOrder: 0,
		createdAt: ts(-65),
	},
	{
		id: "img_006",
		listingId: "list_lend_006",
		asset: "assets/foster-community.png",
		altText: "Camp tent unfolded",
		sortOrder: 0,
		createdAt: ts(-63),
	},
	{
		id: "img_007",
		listingId: "list_borrow_007",
		asset: "assets/hackathon-banner.png",
		altText: "Aluminum roasting pan and wooden handle",
		sortOrder: 0,
		createdAt: ts(-57),
	},
	{
		id: "img_008",
		listingId: "list_trade_008",
		asset: "assets/logo-with-text.png",
		altText: "Stand mixer in bright kitchen",
		sortOrder: 0,
		createdAt: ts(-50),
	},
	{
		id: "img_009",
		listingId: "list_lend_009",
		asset: "assets/error.png",
		altText: "Lantern on a picnic table",
		sortOrder: 0,
		createdAt: ts(-46),
	},
	{
		id: "img_010",
		listingId: "list_borrow_010",
		asset: "assets/find-space.png",
		altText: "Ladder leaning against wall",
		sortOrder: 0,
		createdAt: ts(-39),
	},
	{
		id: "img_011",
		listingId: "list_trade_011",
		asset: "assets/save-money.png",
		altText: "Bike chain set on workbench",
		sortOrder: 0,
		createdAt: ts(-34),
	},
	{
		id: "img_012",
		listingId: "list_lend_012",
		asset: "assets/live-sustainably.png",
		altText: "Compact blender with chopped fruits",
		sortOrder: 0,
		createdAt: ts(-31),
	},
];
const commentRows: SeedComment[] = [
	{
		id: "cmt_001",
		listingId: "list_lend_001",
		authorId: "u_ben_003",
		body: "Great listing, thanks for keeping it cleaned and charged.",
		createdAt: ts(-7),
		updatedAt: ts(-7),
	},
	{
		id: "cmt_002",
		listingId: "list_trade_003",
		authorId: "u_derek_005",
		body: "Love the clarity of the exchange conditions.",
		createdAt: ts(-13),
		updatedAt: ts(-13),
	},
	{
		id: "cmt_003",
		listingId: "list_trade_005",
		authorId: "u_fiona_007",
		body: "Thanks for keeping this cleanly documented. Happy to trade.",
		createdAt: ts(-31),
		updatedAt: ts(-31),
	},
	{
		id: "cmt_004",
		listingId: "list_borrow_007",
		authorId: "u_alma_002",
		body: "This helps a lot for Sunday cooking nights.",
		createdAt: ts(-25),
		updatedAt: ts(-25),
	},
	{
		id: "cmt_005",
		listingId: "list_trade_008",
		authorId: "u_alma_002",
		body: "Trade happened smoothly and both parties were respectful.",
		createdAt: ts(-23),
		updatedAt: ts(-22),
	},
	{
		id: "cmt_006",
		listingId: "list_lend_012",
		authorId: "u_eli_006",
		body: "Request got canceled but still want to thank everyone for the civility.",
		createdAt: ts(-15),
		updatedAt: ts(-15),
	},
	{
		id: "cmt_007",
		listingId: "list_borrow_002",
		authorId: "u_alma_002",
		body: "Good chance we can get this done quickly when someone lends first.",
		createdAt: ts(-4),
		updatedAt: ts(-4),
	},
];

const saveRows: Array<{
	listingId: string;
	userId: string;
	createdAt: number;
}> = [
	{ listingId: "list_lend_001", userId: "u_ben_003", createdAt: ts(-6) },
	{ listingId: "list_trade_003", userId: "u_derek_005", createdAt: ts(-5) },
	{ listingId: "list_trade_005", userId: "u_fiona_007", createdAt: ts(-4) },
	{ listingId: "list_trade_008", userId: "u_alma_002", createdAt: ts(-3) },
	{ listingId: "list_lend_006", userId: "u_eli_006", createdAt: ts(-2) },
];

const reactionRows: Array<{
	listingId: string;
	userId: string;
	createdAt: number;
}> = [
	{ listingId: "list_lend_001", userId: "u_ben_003", createdAt: ts(-6) },
	{ listingId: "list_trade_005", userId: "u_fiona_007", createdAt: ts(-5) },
	{ listingId: "list_trade_008", userId: "u_alma_002", createdAt: ts(-4) },
	{ listingId: "list_borrow_010", userId: "u_clara_004", createdAt: ts(-2) },
];

const messageRows: SeedMessage[] = [
	{
		id: "msg_001",
		requestId: "req_001",
		senderId: "u_alma_002",
		body: "Happy to lend it. Please confirm exact pickup window by noon.",
		createdAt: ts(-7),
		readAt: ts(-6),
	},
	{
		id: "msg_002",
		requestId: "req_001",
		senderId: "u_ben_003",
		body: "Will pickup Saturday at 2 PM and return Sunday morning.",
		createdAt: ts(-7),
		readAt: ts(-7),
	},
	{
		id: "msg_003",
		requestId: "req_002",
		senderId: "u_fiona_007",
		body: "Looks good. Let's coordinate pickup location and confirm both charger pieces.",
		createdAt: ts(-34),
		readAt: ts(-34),
	},
	{
		id: "msg_004",
		requestId: "req_002",
		senderId: "u_eli_006",
		body: "Confirmed. I can bring the grinder tomorrow evening.",
		createdAt: ts(-33),
		readAt: ts(-33),
	},
	{
		id: "msg_005",
		requestId: "req_003",
		senderId: "u_ben_003",
		body: "Thanks for sharing the pan. Pickup is set and I left it clean.",
		createdAt: ts(-26),
		readAt: ts(-25),
	},
	{
		id: "msg_006",
		requestId: "req_003",
		senderId: "u_alma_002",
		body: "Great, complete!",
		createdAt: ts(-20),
		readAt: ts(-20),
	},
];

const reviewRows: SeedReview[] = [
	{
		id: "rev_001",
		requestId: "req_003",
		reviewerId: "u_ben_003",
		rating: 5,
		body: "Everything returned on time and item was perfectly clean.",
		createdAt: ts(-19),
	},
	{
		id: "rev_002",
		requestId: "req_003",
		reviewerId: "u_alma_002",
		rating: 5,
		body: "Easy exchange with very clear timing and polite communication.",
		createdAt: ts(-18),
	},
	{
		id: "rev_003",
		requestId: "req_004",
		reviewerId: "u_alma_002",
		rating: 4,
		body: "Trade was fair, and both parties stayed in touch all week.",
		createdAt: ts(-19),
	},
	{
		id: "rev_004",
		requestId: "req_004",
		reviewerId: "u_ben_003",
		rating: 4,
		body: "The Dutch oven arrived in good shape, trade terms met quickly.",
		createdAt: ts(-18),
	},
];

const ASSET_META: Record<
	string,
	{
		mime: "image/jpeg" | "image/png" | "image/webp";
		width: number;
		height: number;
	}
> = {
	"assets/save-money.png": { mime: "image/png", width: 1536, height: 1024 },
	"assets/find-space.png": { mime: "image/png", width: 1536, height: 1024 },
	"assets/live-sustainably.png": {
		mime: "image/png",
		width: 1536,
		height: 1024,
	},
	"assets/neighborhood.png": { mime: "image/png", width: 1536, height: 1024 },
	"assets/foster-community.png": {
		mime: "image/png",
		width: 1536,
		height: 1024,
	},
	"assets/hackathon-banner.png": {
		mime: "image/png",
		width: 1536,
		height: 1024,
	},
	"assets/logo-with-text.png": { mime: "image/png", width: 1536, height: 1024 },
	"assets/error.png": { mime: "image/png", width: 1536, height: 1024 },
};

const assertSeed: (condition: unknown, message: string) => asserts condition = (
	condition,
	message,
) => {
	if (!condition) {
		throw new Error(`Invalid seed fixture: ${message}`);
	}
};

const assertDistinctIds = <T extends { id: string }>(
	rows: T[],
	kind: string,
) => {
	const byId = new Map<string, T>();

	for (const row of rows) {
		assertSeed(!byId.has(row.id), `duplicate ${kind} id ${row.id}`);
		byId.set(row.id, row);
	}

	return byId;
};

const isDateOnly = (value: string) => {
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		parsed.toISOString().slice(0, 10) === value
	);
};

const assertDateRange = (start: string, end: string, label: string) => {
	assertSeed(isDateOnly(start), `${label} start must be a valid date`);
	assertSeed(isDateOnly(end), `${label} end must be a valid date`);
	assertSeed(start <= end, `${label} end must not precede its start`);
};

const assertTimestamps = (
	row: { createdAt: number; updatedAt: number },
	label: string,
) => {
	assertSeed(row.createdAt > 0, `${label} createdAt must be positive`);
	assertSeed(
		row.updatedAt >= row.createdAt,
		`${label} updatedAt must not precede createdAt`,
	);
};

const assertUniquePair = (
	rows: Array<{ listingId: string; userId: string }>,
	label: string,
) => {
	const pairs = new Set<string>();

	for (const row of rows) {
		const pair = `${row.listingId}:${row.userId}`;
		assertSeed(!pairs.has(pair), `duplicate ${label} ${pair}`);
		pairs.add(pair);
	}
};

const validateSeedFixtures = () => {
	const neighborhoodsById = assertDistinctIds(neighborhoodRows, "neighborhood");
	const usersById = assertDistinctIds(userRows, "user");
	const listingsById = assertDistinctIds(listingRows, "listing");
	const requestsById = assertDistinctIds(requestRows, "request");

	for (const neighborhood of neighborhoodRows) {
		assertTimestamps(neighborhood, `neighborhood ${neighborhood.id}`);
	}

	for (const user of userRows) {
		assertSeed(
			neighborhoodsById.has(user.neighborhoodId),
			`user ${user.id} has an unknown neighborhood`,
		);
		assertSeed(
			new TextEncoder().encode(user.password).length >= 8 &&
				new TextEncoder().encode(user.password).length <= 128,
			`user ${user.id} password must be between 8 and 128 UTF-8 bytes`,
		);
		assertTimestamps(user, `user ${user.id}`);
	}

	for (const listing of listingRows) {
		const owner = usersById.get(listing.ownerId);
		assertSeed(owner, `listing ${listing.id} has an unknown owner`);
		assertSeed(
			owner.neighborhoodId === listing.neighborhoodId,
			`listing ${listing.id} owner is outside its neighborhood`,
		);
		assertSeed(
			neighborhoodsById.has(listing.neighborhoodId),
			`listing ${listing.id} has an unknown neighborhood`,
		);
		assertDateRange(
			listing.availableFrom,
			listing.availableThrough,
			`listing ${listing.id}`,
		);
		assertTimestamps(listing, `listing ${listing.id}`);

		if (listing.type === "lend") {
			assertSeed(
				!listing.wantedItem,
				`lend listing ${listing.id} must not have wantedItem`,
			);
		} else {
			assertSeed(
				Boolean(listing.wantedItem?.trim()),
				`${listing.type} listing ${listing.id} requires wantedItem`,
			);
		}

		const isDeleted = listing.deletedAt !== undefined;
		assertSeed(
			isDeleted === (listing.deletedByUserId !== undefined),
			`listing ${listing.id} deletion actor must match tombstone state`,
		);
		assertSeed(
			isDeleted === (listing.deletedReason !== undefined),
			`listing ${listing.id} deletion reason must match tombstone state`,
		);
		assertSeed(
			!isDeleted ||
				listing.status === "withdrawn" ||
				listing.status === "completed",
			`listing ${listing.id} tombstone requires withdrawn or completed status`,
		);
	}

	for (const request of requestRows) {
		const listing = listingsById.get(request.listingId);
		const requester = usersById.get(request.requesterId);
		assertSeed(listing, `request ${request.id} has an unknown listing`);
		assertSeed(requester, `request ${request.id} has an unknown requester`);
		assertSeed(
			requester.neighborhoodId === listing.neighborhoodId,
			`request ${request.id} crosses neighborhoods`,
		);
		assertSeed(
			requester.id !== listing.ownerId,
			`request ${request.id} is a self-request`,
		);
		assertTimestamps(request, `request ${request.id}`);

		if (request.status === "completed") {
			assertSeed(
				listing.status === "completed",
				`completed request ${request.id} requires a completed listing`,
			);
			assertSeed(
				request.updatedAt === listing.updatedAt,
				`completed request ${request.id} must share its listing completion timestamp`,
			);
		}

		const hasDateRange =
			request.requestedStart !== undefined ||
			request.requestedEnd !== undefined;
		assertSeed(
			!hasDateRange ||
				(request.requestedStart !== undefined &&
					request.requestedEnd !== undefined),
			`request ${request.id} must include both requested dates or neither`,
		);

		if (request.requestedStart && request.requestedEnd) {
			assertDateRange(
				request.requestedStart,
				request.requestedEnd,
				`request ${request.id}`,
			);
		}

		const hasOfferedItem =
			request.offeredTitle !== undefined ||
			request.offeredDescription !== undefined ||
			request.offeredCondition !== undefined;

		if (listing.type === "lend") {
			assertSeed(
				request.requestedStart !== undefined &&
					request.requestedEnd !== undefined,
				`lend request ${request.id} requires requested dates`,
			);
			assertSeed(
				!hasOfferedItem,
				`lend request ${request.id} must not include an offered item`,
			);
		} else {
			assertSeed(
				request.offeredTitle !== undefined &&
					request.offeredDescription !== undefined &&
					request.offeredCondition !== undefined,
				`${listing.type} request ${request.id} requires a complete offered item`,
			);
		}

		if (request.status === "cancelled") {
			assertSeed(
				request.cancelledByUserId === request.requesterId ||
					request.cancelledByUserId === listing.ownerId,
				`cancelled request ${request.id} requires a participant actor`,
			);
			assertSeed(
				Boolean(request.cancellationReason?.trim()),
				`cancelled request ${request.id} requires a reason`,
			);
		} else {
			assertSeed(
				request.cancelledByUserId === undefined &&
					request.cancellationReason === undefined,
				`non-cancelled request ${request.id} must not have cancellation metadata`,
			);
		}
	}

	for (const listing of listingRows) {
		const listingRequests = requestRows.filter(
			(request) => request.listingId === listing.id,
		);
		const accepted = listingRequests.filter(
			(request) => request.status === "accepted",
		);
		const completed = listingRequests.filter(
			(request) => request.status === "completed",
		);
		const pending = listingRequests.filter(
			(request) => request.status === "pending",
		);

		assertSeed(
			accepted.length <= 1,
			`listing ${listing.id} cannot have multiple accepted requests`,
		);
		assertSeed(
			completed.length <= 1,
			`listing ${listing.id} cannot have multiple completed requests`,
		);
		assertSeed(
			(listing.status === "completed") === (completed.length === 1),
			`listing ${listing.id} completed status must match one completed request`,
		);

		if (listing.status === "active") {
			assertSeed(
				accepted.length === 0,
				`active listing ${listing.id} cannot have an accepted request`,
			);
		}

		if (listing.status === "reserved") {
			assertSeed(
				accepted.length === 1 && pending.length === 0,
				`reserved listing ${listing.id} requires one accepted request and no pending requests`,
			);
		}

		if (listing.status === "completed") {
			assertSeed(
				accepted.length === 0 && pending.length === 0,
				`completed listing ${listing.id} cannot have active requests`,
			);
		}

		if (listing.status === "withdrawn") {
			assertSeed(
				accepted.length === 0 && pending.length === 0,
				`withdrawn listing ${listing.id} cannot have active requests`,
			);
		}
	}

	for (const comment of commentRows) {
		const listing = listingsById.get(comment.listingId);
		const author = usersById.get(comment.authorId);
		assertSeed(listing, `comment ${comment.id} has an unknown listing`);
		assertSeed(author, `comment ${comment.id} has an unknown author`);
		assertSeed(
			author.neighborhoodId === listing.neighborhoodId,
			`comment ${comment.id} crosses neighborhoods`,
		);
		assertTimestamps(comment, `comment ${comment.id}`);
	}

	const validateListingInteractions = (
		rows: Array<{ listingId: string; userId: string; createdAt: number }>,
		label: string,
	) => {
		assertUniquePair(rows, label);

		for (const row of rows) {
			const listing = listingsById.get(row.listingId);
			const user = usersById.get(row.userId);
			assertSeed(listing, `${label} has an unknown listing ${row.listingId}`);
			assertSeed(user, `${label} has an unknown user ${row.userId}`);
			assertSeed(
				user.neighborhoodId === listing.neighborhoodId,
				`${label} ${row.listingId}:${row.userId} crosses neighborhoods`,
			);
			assertSeed(
				row.createdAt > 0,
				`${label} ${row.listingId}:${row.userId} must have a timestamp`,
			);
		}
	};

	validateListingInteractions(saveRows, "save");
	validateListingInteractions(reactionRows, "reaction");

	const commentIds = assertDistinctIds(commentRows, "comment");
	assertSeed(
		commentIds.size === commentRows.length,
		"comment ids must be unique",
	);
	const imageIds = assertDistinctIds(listingImageRows, "listing image");
	assertSeed(
		imageIds.size === listingImageRows.length,
		"listing image ids must be unique",
	);
	const imagePositions = new Set<string>();

	for (const image of listingImageRows) {
		assertSeed(
			listingsById.has(image.listingId),
			`image ${image.id} has an unknown listing`,
		);
		assertSeed(
			Boolean(ASSET_META[image.asset]),
			`image ${image.id} has unknown asset metadata`,
		);
		assertSeed(
			image.sortOrder >= 0 && image.sortOrder <= 10,
			`image ${image.id} sortOrder is out of range`,
		);
		assertSeed(
			image.createdAt > 0,
			`image ${image.id} createdAt must be positive`,
		);
		const position = `${image.listingId}:${image.sortOrder}`;
		assertSeed(
			!imagePositions.has(position),
			`duplicate image sort position ${position}`,
		);
		imagePositions.add(position);
	}

	const messageIds = assertDistinctIds(messageRows, "message");
	assertSeed(
		messageIds.size === messageRows.length,
		"message ids must be unique",
	);

	for (const message of messageRows) {
		const request = requestsById.get(message.requestId);
		assertSeed(request, `message ${message.id} has an unknown request`);
		const listing = listingsById.get(request.listingId);
		assertSeed(listing, `message ${message.id} request has an unknown listing`);
		assertSeed(
			message.senderId === listing.ownerId ||
				message.senderId === request.requesterId,
			`message ${message.id} sender is not a request participant`,
		);
		assertSeed(
			message.createdAt > 0,
			`message ${message.id} createdAt must be positive`,
		);
		assertSeed(
			message.readAt === undefined || message.readAt >= message.createdAt,
			`message ${message.id} readAt must not precede createdAt`,
		);
	}

	const reviewIds = assertDistinctIds(reviewRows, "review");
	assertSeed(reviewIds.size === reviewRows.length, "review ids must be unique");
	const reviewPairs = new Set<string>();

	for (const review of reviewRows) {
		const request = requestsById.get(review.requestId);
		assertSeed(request, `review ${review.id} has an unknown request`);
		const listing = listingsById.get(request.listingId);
		assertSeed(listing, `review ${review.id} request has an unknown listing`);
		assertSeed(
			request.status === "completed",
			`review ${review.id} requires a completed request`,
		);
		assertSeed(
			review.reviewerId === listing.ownerId ||
				review.reviewerId === request.requesterId,
			`review ${review.id} reviewer is not a request participant`,
		);
		assertSeed(
			review.rating >= 1 && review.rating <= 5,
			`review ${review.id} rating is out of range`,
		);
		assertSeed(
			review.createdAt > 0,
			`review ${review.id} createdAt must be positive`,
		);
		assertSeed(
			review.createdAt >= request.updatedAt,
			`review ${review.id} cannot predate request completion`,
		);
		const pair = `${review.requestId}:${review.reviewerId}`;
		assertSeed(!reviewPairs.has(pair), `duplicate review ${pair}`);
		reviewPairs.add(pair);
	}
};
const normalizeAssetPath = (assetPath: string) =>
	assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;

const assetCache = new Map<string, Promise<Uint8Array>>();

const loadAsset = (assetPath: string): Promise<Uint8Array> => {
	if (!assetCache.has(assetPath)) {
		const resolved = resolve(process.cwd(), normalizeAssetPath(assetPath));
		const file = Bun.file(resolved);
		const pending = file
			.exists()
			.then((exists) => {
				if (!exists) {
					throw new Error(`Seed asset missing: ${assetPath}`);
				}
				return file.arrayBuffer();
			})
			.then((buffer) => new Uint8Array(buffer));

		assetCache.set(assetPath, pending);
	}

	const cachedAsset = assetCache.get(assetPath);
	if (!cachedAsset) {
		throw new Error(`Seed asset cache missing: ${assetPath}`);
	}

	return cachedAsset;
};

const insertNeighborhood = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO neighborhoods (
      id,
      slug,
      name,
      city,
      state,
      timezone,
      description,
      image_path,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

const insertUser = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO users (
      id,
      email,
      password_hash,
      name,
      handle,
      avatar_path,
      bio,
      neighborhood_id,
      is_demo,
      created_at,
      updated_at,
      last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

const insertListing = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO listings (
      id,
      owner_id,
      neighborhood_id,
      type,
      title,
      description,
      category,
      condition,
      available_from,
      available_through,
      availability_notes,
      wanted_item,
      status,
      deleted_at,
      deleted_by_user_id,
      deleted_reason,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

const insertRequest = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO requests (
      id,
      listing_id,
      requester_id,
      requested_start,
      requested_end,
      offered_title,
      offered_description,
      offered_condition,
      opening_message,
      status,
      cancelled_by_user_id,
      cancellation_reason,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

const insertComment = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO comments (
      id,
      listing_id,
      author_id,
      body,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?);
  `);

const insertSave = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO listing_saves (
      listing_id,
      user_id,
      created_at
    ) VALUES (?, ?, ?);
  `);

const insertReaction = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO listing_reactions (
      listing_id,
      user_id,
      created_at
    ) VALUES (?, ?, ?);
  `);

const insertMessage = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO messages (
      id,
      request_id,
      sender_id,
      body,
      created_at,
      read_at
    ) VALUES (?, ?, ?, ?, ?, ?);
  `);

const insertReview = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO reviews (
      id,
      request_id,
      reviewer_id,
      rating,
      body,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?);
  `);

const insertListingImage = (db: Database) =>
	db.prepare(`
    INSERT OR IGNORE INTO listing_images (
      id,
      listing_id,
      mime_type,
      width,
      height,
      alt_text,
      image_data,
      byte_size,
      sort_order,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

export async function seedDatabase(
	db: Database,
	{ mode = "development" }: SeedOptions = {},
): Promise<void> {
	validateSeedFixtures();

	const usersWithHashes = await Promise.all(
		userRows.map(async (user) => ({
			...user,
			passwordHash: await Bun.password.hash(
				mode === "development"
					? user.password
					: randomBytes(32).toString("base64url"),
				{ algorithm: "argon2id" },
			),
		})),
	);

	const preparedNeighborhood = insertNeighborhood(db);
	const preparedUser = insertUser(db);
	const preparedListing = insertListing(db);
	const preparedRequest = insertRequest(db);
	const preparedComment = insertComment(db);
	const preparedSave = insertSave(db);
	const preparedReaction = insertReaction(db);
	const preparedMessage = insertMessage(db);
	const preparedReview = insertReview(db);
	const preparedImage = insertListingImage(db);
	const updateFixturePassword = db.prepare(
		"UPDATE users SET password_hash = ? WHERE id = ?",
	);
	const deleteFixtureSessions = db.prepare(
		"DELETE FROM sessions WHERE user_id = ?",
	);

	db.run("BEGIN IMMEDIATE");
	try {
		if (mode === "public-demo") {
			for (const user of usersWithHashes) {
				updateFixturePassword.run(user.passwordHash, user.id);
				deleteFixtureSessions.run(user.id);
			}
		}

		for (const row of neighborhoodRows) {
			preparedNeighborhood.run(
				row.id,
				row.slug,
				row.name,
				row.city,
				row.state,
				row.timezone,
				row.description,
				row.imagePath,
				row.createdAt,
				row.updatedAt,
			);
		}

		for (const user of usersWithHashes) {
			preparedUser.run(
				user.id,
				user.email,
				user.passwordHash,
				user.name,
				user.handle,
				user.avatarPath,
				user.bio,
				user.neighborhoodId,
				user.isDemo ? 1 : 0,
				user.createdAt,
				user.updatedAt,
				user.updatedAt,
			);
		}

		for (const listing of listingRows) {
			preparedListing.run(
				listing.id,
				listing.ownerId,
				listing.neighborhoodId,
				listing.type,
				listing.title,
				listing.description,
				listing.category,
				listing.condition,
				listing.availableFrom,
				listing.availableThrough,
				listing.availabilityNotes ?? null,
				listing.wantedItem ?? null,
				listing.status,
				listing.deletedAt ?? null,
				listing.deletedByUserId ?? null,
				listing.deletedReason ?? null,
				listing.createdAt,
				listing.updatedAt,
			);
		}

		for (const request of requestRows) {
			preparedRequest.run(
				request.id,
				request.listingId,
				request.requesterId,
				request.requestedStart ?? null,
				request.requestedEnd ?? null,
				request.offeredTitle ?? null,
				request.offeredDescription ?? null,
				request.offeredCondition ?? null,
				request.openingMessage,
				request.status,
				request.cancelledByUserId ?? null,
				request.cancellationReason ?? null,
				request.createdAt,
				request.updatedAt,
			);
		}

		for (const comment of commentRows) {
			preparedComment.run(
				comment.id,
				comment.listingId,
				comment.authorId,
				comment.body,
				comment.createdAt,
				comment.updatedAt,
			);
		}

		for (const save of saveRows) {
			preparedSave.run(save.listingId, save.userId, save.createdAt);
		}

		for (const reaction of reactionRows) {
			preparedReaction.run(
				reaction.listingId,
				reaction.userId,
				reaction.createdAt,
			);
		}

		for (const message of messageRows) {
			preparedMessage.run(
				message.id,
				message.requestId,
				message.senderId,
				message.body,
				message.createdAt,
				message.readAt ?? null,
			);
		}

		for (const review of reviewRows) {
			preparedReview.run(
				review.id,
				review.requestId,
				review.reviewerId,
				review.rating,
				review.body,
				review.createdAt,
			);
		}

		for (const image of listingImageRows) {
			const bytes = await loadAsset(image.asset);
			const metadata = ASSET_META[image.asset];
			if (!metadata) {
				throw new Error(`Seed image metadata missing: ${image.asset}`);
			}

			preparedImage.run(
				image.id,
				image.listingId,
				metadata.mime,
				metadata.width,
				metadata.height,
				image.altText,
				bytes,
				bytes.length,
				image.sortOrder,
				image.createdAt,
			);
		}

		db.run("COMMIT");
	} catch (error) {
		db.run("ROLLBACK");
		throw error;
	}
}
