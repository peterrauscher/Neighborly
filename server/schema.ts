import type { Database } from "bun:sqlite";

export type Migration = {
	id: number;
	name: string;
	up: (db: Database) => void;
};

const createMigrationsTable = `
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at INTEGER NOT NULL
  );
`;

const createNeighborhoods = `
  CREATE TABLE IF NOT EXISTS neighborhoods (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK(length(trim(slug)) BETWEEN 3 AND 64),
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
    city TEXT NOT NULL CHECK(length(trim(city)) BETWEEN 2 AND 120),
    state TEXT NOT NULL CHECK(length(trim(state)) BETWEEN 2 AND 100),
    timezone TEXT NOT NULL CHECK(length(trim(timezone)) BETWEEN 2 AND 64),
    description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 1200),
    image_path TEXT NOT NULL CHECK(length(trim(image_path)) BETWEEN 1 AND 256),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_neighborhoods_city_state ON neighborhoods(city, state);
`;

const createUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE CHECK(length(trim(email)) BETWEEN 5 AND 254),
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
    handle TEXT NOT NULL UNIQUE CHECK(length(trim(handle)) BETWEEN 3 AND 32),
    avatar_path TEXT,
    bio TEXT NOT NULL DEFAULT '' CHECK(length(bio) <= 500),
    neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0, 1)),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    last_active_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_users_neighborhood ON users(neighborhood_id);
  CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
`;

const createSessions = `
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    expires_at INTEGER NOT NULL CHECK(expires_at > 0),
    last_seen_at INTEGER,
    user_agent TEXT,
    revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0, 1)),
    revoked_at INTEGER,
    CHECK(expires_at > created_at)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`;

const createListings = `
  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK(type IN ('lend', 'borrow', 'trade')),
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 4 AND 120),
    description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2500),
    category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 2 AND 60),
    condition TEXT NOT NULL CHECK(condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    available_from TEXT NOT NULL CHECK(date(available_from) IS NOT NULL),
    available_through TEXT NOT NULL CHECK(date(available_through) IS NOT NULL AND available_through >= available_from),
    availability_notes TEXT CHECK(availability_notes IS NULL OR length(trim(availability_notes)) <= 400),
    wanted_item TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'reserved', 'completed', 'withdrawn')),
    deleted_at INTEGER,
    deleted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    deleted_reason TEXT CHECK(deleted_reason IS NULL OR length(trim(deleted_reason)) <= 400),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    CHECK(
      CASE
        WHEN type = 'lend' THEN wanted_item IS NULL OR trim(wanted_item) = ''
        WHEN type IN ('borrow', 'trade') THEN wanted_item IS NOT NULL AND trim(wanted_item) <> ''
        ELSE 0
      END
    ),
    CHECK(deleted_at IS NULL OR status IN ('withdrawn', 'completed')),
    CHECK(deleted_by_user_id IS NULL OR deleted_at IS NOT NULL),
    CHECK(deleted_reason IS NULL OR deleted_at IS NOT NULL),
    CHECK(created_at <= updated_at)
  );

  CREATE INDEX IF NOT EXISTS idx_listings_neighborhood_status ON listings(neighborhood_id, status);
  CREATE INDEX IF NOT EXISTS idx_listings_owner_status ON listings(owner_id, status);
  CREATE INDEX IF NOT EXISTS idx_listings_type_status ON listings(type, status);
  CREATE INDEX IF NOT EXISTS idx_listings_updated_at ON listings(updated_at DESC);
`;

const createListingImages = `
  CREATE TABLE IF NOT EXISTS listing_images (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    width INTEGER NOT NULL CHECK(width > 0 AND width <= 5000),
    height INTEGER NOT NULL CHECK(height > 0 AND height <= 5000),
    alt_text TEXT NOT NULL CHECK(length(trim(alt_text)) BETWEEN 1 AND 140),
    image_data BLOB NOT NULL,
    byte_size INTEGER NOT NULL CHECK(byte_size > 0),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK(sort_order >= 0 AND sort_order <= 10),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    UNIQUE (listing_id, sort_order)
  );

  CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id, sort_order);
`;

const createListingEngagement = `
  CREATE TABLE IF NOT EXISTS listing_saves (
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    PRIMARY KEY (listing_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS listing_reactions (
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    PRIMARY KEY (listing_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_listing_saves_user_id ON listing_saves(user_id);
  CREATE INDEX IF NOT EXISTS idx_listing_reactions_user_id ON listing_reactions(user_id);
`;

const createComments = `
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    CHECK(created_at <= updated_at)
  );

  CREATE INDEX IF NOT EXISTS idx_comments_listing_created_at ON comments(listing_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
`;

const createRequests = `
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_start TEXT,
    requested_end TEXT,
    offered_title TEXT,
    offered_description TEXT,
    offered_condition TEXT,
    opening_message TEXT NOT NULL CHECK(length(trim(opening_message)) BETWEEN 8 AND 1500),
    status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')),
    cancelled_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    cancellation_reason TEXT CHECK(cancellation_reason IS NULL OR length(trim(cancellation_reason)) <= 500),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    updated_at INTEGER NOT NULL CHECK(updated_at > 0),
    CHECK(created_at <= updated_at),
    CHECK(
      (requested_start IS NULL AND requested_end IS NULL) OR (
        date(requested_start) IS NOT NULL AND
        date(requested_end) IS NOT NULL AND
        requested_end >= requested_start
      )
    ),
    CHECK(
      offered_title IS NULL OR (
        trim(offered_title) <> '' AND
        offered_description IS NOT NULL AND trim(offered_description) <> '' AND
        offered_condition IN ('new', 'like_new', 'good', 'fair', 'poor')
      )
    ),
    CHECK(
      (status = 'cancelled' AND cancelled_by_user_id IS NOT NULL) OR status <> 'cancelled'
    ),
    CHECK(
      (cancellation_reason IS NULL AND status != 'cancelled') OR (cancellation_reason IS NOT NULL AND status = 'cancelled')
    )
  );

  CREATE INDEX IF NOT EXISTS idx_requests_listing_status ON requests(listing_id, status);
  CREATE INDEX IF NOT EXISTS idx_requests_requester_status ON requests(requester_id, status);
  CREATE INDEX IF NOT EXISTS idx_requests_updated_at ON requests(updated_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_one_accepted_per_listing ON requests(listing_id) WHERE status = 'accepted';
`;

const createMessagesReviewsContacts = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    read_at INTEGER,
    CHECK(read_at IS NULL OR read_at >= created_at)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_request_created_at ON messages(request_id, created_at);

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
    reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 1000),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    UNIQUE (request_id, reviewer_id)
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_request_id ON reviews(request_id);

  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
    email TEXT NOT NULL CHECK(length(trim(email)) BETWEEN 5 AND 254),
    message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 10 AND 2000),
    created_at INTEGER NOT NULL CHECK(created_at > 0),
    expires_at INTEGER NOT NULL CHECK(expires_at > 0),
    honeypot TEXT NOT NULL DEFAULT '',
    CHECK(expires_at > created_at)
  );

  CREATE INDEX IF NOT EXISTS idx_contact_messages_expires_at ON contact_messages(expires_at);
`;

const addListingPublicPreview = `
  ALTER TABLE listings ADD COLUMN is_public_preview INTEGER NOT NULL DEFAULT 0 CHECK(is_public_preview IN (0, 1));

  CREATE INDEX IF NOT EXISTS idx_listings_public_preview_active
  ON listings(updated_at DESC)
  WHERE is_public_preview = 1 AND status = 'active';
`;

const addInteractionReadIndexes = `
  CREATE INDEX IF NOT EXISTS idx_requests_requester_updated_at
  ON requests(requester_id, updated_at DESC, id DESC);

  CREATE INDEX IF NOT EXISTS idx_requests_listing_updated_at
  ON requests(listing_id, updated_at DESC, id DESC);

  CREATE INDEX IF NOT EXISTS idx_messages_request_created_at_id
  ON messages(request_id, created_at ASC, id ASC);

  CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id
  ON reviews(reviewer_id);

  CREATE INDEX IF NOT EXISTS idx_users_neighborhood_created_at
  ON users(neighborhood_id, created_at DESC, id DESC);
`;

const addRequestResponseHistory = `
  ALTER TABLE requests ADD COLUMN owner_responded_at INTEGER
  CHECK(owner_responded_at IS NULL OR owner_responded_at > 0);

  UPDATE requests
  SET owner_responded_at = updated_at
  WHERE owner_responded_at IS NULL
    AND status IN ('accepted', 'declined', 'completed');

  CREATE TRIGGER IF NOT EXISTS requests_set_owner_response_on_insert
  AFTER INSERT ON requests
  WHEN NEW.owner_responded_at IS NULL
    AND NEW.status IN ('accepted', 'declined', 'completed')
  BEGIN
    UPDATE requests
    SET owner_responded_at = NEW.updated_at
    WHERE id = NEW.id AND owner_responded_at IS NULL;
  END;

  CREATE TRIGGER IF NOT EXISTS requests_set_owner_response_on_pending_resolution
  AFTER UPDATE OF status ON requests
  WHEN OLD.status = 'pending'
    AND NEW.status IN ('accepted', 'declined')
    AND NEW.owner_responded_at IS NULL
  BEGIN
    UPDATE requests
    SET owner_responded_at = NEW.updated_at
    WHERE id = NEW.id AND owner_responded_at IS NULL;
  END;

  CREATE TRIGGER IF NOT EXISTS requests_require_owner_resolution_for_response
  BEFORE UPDATE OF owner_responded_at ON requests
  WHEN OLD.owner_responded_at IS NULL
    AND NEW.owner_responded_at IS NOT NULL
    AND NEW.status NOT IN ('accepted', 'declined', 'completed')
  BEGIN
    SELECT RAISE(ABORT, 'owner response requires an owner resolution');
  END;

  CREATE TRIGGER IF NOT EXISTS requests_prevent_owner_response_rewrite
  BEFORE UPDATE OF owner_responded_at ON requests
  WHEN OLD.owner_responded_at IS NOT NULL
    AND NEW.owner_responded_at IS NOT OLD.owner_responded_at
  BEGIN
    SELECT RAISE(ABORT, 'owner response timestamp is immutable');
  END;
`;

const migrationStatements: string[] = [
	createMigrationsTable,
	createNeighborhoods,
	createUsers,
	createSessions,
	createListings,
	createListingImages,
	createListingEngagement,
	createComments,
	createRequests,
	createMessagesReviewsContacts,
	addListingPublicPreview,
	addInteractionReadIndexes,
	addRequestResponseHistory,
];

const migrationNames = [
	"bootstrap_schema",
	"neighborhoods",
	"users",
	"sessions",
	"listings",
	"listing_images",
	"listing_engagement",
	"comments",
	"requests",
	"messages_reviews_contacts",
	"listing_public_preview",
	"interaction_read_indexes",
	"request_response_history",
];

export const migrations: Migration[] = migrationStatements.map(
	(sql, index) => ({
		id: index + 1,
		name: `000${index + 1}_${migrationNames[index]}`,
		up(db) {
			db.exec(sql);
		},
	}),
);

export const MIGRATION_TABLE_NAME = "migrations" as const;
