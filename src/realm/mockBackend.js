import { ApolloLink, Observable } from "@apollo/client";

// Inline SVG avatars that work 100% offline with zero external network calls
const createAvatar = (name, bg = "#00d1b2") => {
  const initials = (name || "Neighbor")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="50" fill="${bg}"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="700">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const DEFAULT_NEIGHBORHOOD = {
  label: "Seattle, WA, USA",
  placeId: "ChIJVTPokUsQkFQR29GelWAxqGc",
};

export const INITIAL_USERS = [
  {
    accountId: "user_peter",
    name: "Peter Rauscher",
    email: "peter@example.com",
    avatar: createAvatar("Peter Rauscher", "#ff3860"),
    neighborhood: DEFAULT_NEIGHBORHOOD,
    bio: "Atlas Madness 2023 Grand Prize Winner! Creator of Neighborly. Passionate about community sharing, sustainability, and open-source tools.",
    lastActive: new Date(Date.now() - 1000 * 60 * 12),
  },
  {
    accountId: "user_sarah",
    name: "Sarah Jenkins",
    email: "sarah@example.com",
    avatar: createAvatar("Sarah Jenkins", "#3273dc"),
    neighborhood: DEFAULT_NEIGHBORHOOD,
    bio: "Avid gardener and DIY home improver on Elm St. Happy to share power tools and gardening equipment.",
    lastActive: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    accountId: "user_marcus",
    name: "Marcus Chen",
    email: "marcus@example.com",
    avatar: createAvatar("Marcus Chen", "#ffdd57"),
    neighborhood: DEFAULT_NEIGHBORHOOD,
    bio: "Cyclist, outdoor enthusiast, and tinkerer. Have bike repair stands and camping gear available for neighbors.",
    lastActive: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    accountId: "user_emily",
    name: "Emily Rodriguez",
    email: "emily@example.com",
    avatar: createAvatar("Emily Rodriguez", "#48c774"),
    neighborhood: DEFAULT_NEIGHBORHOOD,
    bio: "Baker and plant lover. Let's trade homegrown heirloom tomatoes, sourdough starter, and culinary herbs!",
    lastActive: new Date(Date.now() - 1000 * 60 * 300),
  },
  {
    accountId: "user_david",
    name: "David Kim",
    email: "david@example.com",
    avatar: createAvatar("David Kim", "#9b51e0"),
    neighborhood: DEFAULT_NEIGHBORHOOD,
    bio: "Weekend woodworker. Have heavy-duty tools, extension cords, and folding tables ready to lend.",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

export const INITIAL_POSTS = [
  {
    _id: "post_1",
    authorId: "user_peter",
    neighborhood: DEFAULT_NEIGHBORHOOD,
    postType: "lend",
    content:
      "I have a Honda self-propelled lawnmower and edger ready to lend out this weekend! Tuned up with fresh oil and gas. Pick up anytime on 14th Ave.",
    postedAt: new Date(Date.now() - 1000 * 60 * 35),
    images: ["/images/lawnmower.svg"],
  },
  {
    _id: "post_2",
    authorId: "user_sarah",
    neighborhood: DEFAULT_NEIGHBORHOOD,
    postType: "borrow",
    content:
      "Does anyone have a 16ft extension ladder I could borrow this Saturday morning? Need to clear gutters before the rain. Happy to return it with a fresh loaf of sourdough!",
    postedAt: new Date(Date.now() - 1000 * 60 * 110),
    images: ["/images/ladder.svg"],
  },
  {
    _id: "post_3",
    authorId: "user_emily",
    neighborhood: DEFAULT_NEIGHBORHOOD,
    postType: "trade",
    content:
      "Looking to trade my extra heirloom tomato and bell pepper seedlings! Have 6 healthy cups ready for planting. Would love to trade for rosemary, mint, or gardening gloves.",
    postedAt: new Date(Date.now() - 1000 * 60 * 240),
    images: ["/images/seedlings.svg"],
  },
  {
    _id: "post_4",
    authorId: "user_david",
    neighborhood: DEFAULT_NEIGHBORHOOD,
    postType: "lend",
    content:
      "DeWalt 20V Cordless drill and 50-piece bit set available to borrow. Great for mounting TVs or assembling furniture. Drop a note if you need it!",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 14),
    images: ["/images/drill.svg"],
  },
  {
    _id: "post_5",
    authorId: "user_marcus",
    neighborhood: DEFAULT_NEIGHBORHOOD,
    postType: "lend",
    content:
      "Have clean, dry garage storage space (about 8x10 ft) available for the next 6 weeks while my travel trailer is out. Perfect if you are staging a remodel.",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 30),
    images: ["/images/find-space.png"],
  },
  {
    _id: "post_6",
    authorId: "user_peter",
    neighborhood: DEFAULT_NEIGHBORHOOD,
    postType: "trade",
    content:
      "Trading board games for game night! Have complete copies of Wingspan and Catan in mint condition. Looking to trade for Ticket to Ride or Cascadia.",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    images: ["/images/games.svg"],
  },
];

const STORAGE_KEYS = {
  USERS: "neighborly_mock_users",
  POSTS: "neighborly_mock_posts",
  CURRENT_USER: "neighborly_mock_current_user",
};

// Safe storage access
const getStorageItem = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    return fallback;
  }
};

const setStorageItem = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn("localStorage write failed:", err);
  }
};

export const getStoredUsers = () => {
  const users = getStorageItem(STORAGE_KEYS.USERS, null);
  if (!users || !Array.isArray(users) || users.length === 0) {
    setStorageItem(STORAGE_KEYS.USERS, INITIAL_USERS);
    return INITIAL_USERS;
  }
  return users;
};

export const getStoredPosts = () => {
  const posts = getStorageItem(STORAGE_KEYS.POSTS, null);
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    setStorageItem(STORAGE_KEYS.POSTS, INITIAL_POSTS);
    return INITIAL_POSTS;
  }
  const migrated = posts.map((p) => {
    if (p._id === "post_1" && p.images?.[0]?.includes("unsplash")) {
      return { ...p, images: ["/images/lawnmower.svg"] };
    }
    if (p._id === "post_2" && p.images?.[0]?.includes("unsplash")) {
      return { ...p, images: ["/images/ladder.svg"] };
    }
    if (p._id === "post_3" && p.images?.[0]?.includes("unsplash")) {
      return { ...p, images: ["/images/seedlings.svg"] };
    }
    if (p._id === "post_4" && p.images?.[0]?.includes("unsplash")) {
      return { ...p, images: ["/images/drill.svg"] };
    }
    if (p._id === "post_6" && p.images?.[0]?.includes("unsplash")) {
      return { ...p, images: ["/images/games.svg"] };
    }
    return p;
  });
  return migrated;
};

export const getMockUser = (accountId) => {
  const users = getStoredUsers();
  return users.find((u) => u.accountId === accountId) || null;
};

export const getMockNeighbors = (placeId) => {
  const users = getStoredUsers();
  // Return users in this neighborhood, or all neighbors if none match specifically
  const matched = users.filter(
    (u) => u.neighborhood && u.neighborhood.placeId === placeId
  );
  return matched.length > 0 ? matched : users;
};

export const getMockPostsWithAuthors = ({ placeId, postType }) => {
  const posts = getStoredPosts();
  const users = getStoredUsers();

  let filtered = posts;

  // Filter by post type if not "all"
  if (postType && postType !== "all") {
    filtered = filtered.filter((p) => p.postType === postType);
  }

  // Filter by neighborhood if specific
  if (placeId) {
    const byPlace = filtered.filter(
      (p) => p.neighborhood && p.neighborhood.placeId === placeId
    );
    // If neighborhood has specific posts, show those; otherwise show all to keep feed lively
    if (byPlace.length > 0) {
      filtered = byPlace;
    }
  }

  // Enrich with author info
  return filtered.map((post) => {
    const author = users.find((u) => u.accountId === post.authorId) || {
      accountId: post.authorId,
      name: "Neighbor",
      avatar: createAvatar("Neighbor"),
    };

    return {
      content: post.content,
      images: post.images || [],
      neighborhood: post.neighborhood || DEFAULT_NEIGHBORHOOD,
      postType: post.postType,
      postedAt: post.postedAt,
      author: {
        accountId: author.accountId,
        avatar: author.avatar,
        name: author.name,
      },
    };
  });
};

export const getMockUserPosts = (accountId) => {
  const posts = getStoredPosts();
  return posts.filter((p) => p.authorId === accountId);
};

export const insertMockPost = (data) => {
  const posts = getStoredPosts();
  const newPost = {
    _id: `post_${Date.now()}`,
    authorId: data.authorId,
    content: data.content,
    images: data.images || [],
    neighborhood: data.neighborhood || DEFAULT_NEIGHBORHOOD,
    postType: data.postType,
    postedAt: data.postedAt || new Date(),
  };

  const updated = [newPost, ...posts];
  setStorageItem(STORAGE_KEYS.POSTS, updated);
  return newPost;
};

export const deleteMockPost = (query) => {
  const posts = getStoredPosts();
  const updated = posts.filter((p) => {
    if (query.authorId && p.authorId !== query.authorId) return true;
    if (query.content && p.content !== query.content) return true;
    return false;
  });
  setStorageItem(STORAGE_KEYS.POSTS, updated);
  return { success: true };
};

// User authentication helpers
export const getActiveMockUser = () => {
  return getStorageItem(STORAGE_KEYS.CURRENT_USER, null);
};

export const setActiveMockUser = (user) => {
  setStorageItem(STORAGE_KEYS.CURRENT_USER, user);
};

export const removeActiveMockUser = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  } catch (err) {}
};

export const updateMockUserName = (accountId, name) => {
  const users = getStoredUsers();
  const updated = users.map((u) =>
    u.accountId === accountId ? { ...u, name } : u
  );
  setStorageItem(STORAGE_KEYS.USERS, updated);

  const current = getActiveMockUser();
  if (current && current.accountId === accountId) {
    const updatedCurrent = {
      ...current,
      name,
      customData: { ...current.customData, name },
    };
    setActiveMockUser(updatedCurrent);
    return updatedCurrent;
  }
  return null;
};

export const updateMockUserNeighborhood = (accountId, neighborhood) => {
  const users = getStoredUsers();
  const updated = users.map((u) =>
    u.accountId === accountId ? { ...u, neighborhood } : u
  );
  setStorageItem(STORAGE_KEYS.USERS, updated);

  const current = getActiveMockUser();
  if (current && current.accountId === accountId) {
    const updatedCurrent = {
      ...current,
      customData: { ...current.customData, neighborhood },
    };
    setActiveMockUser(updatedCurrent);
    return updatedCurrent;
  }
  return null;
};

export const createMockUserObject = (userData) => {
  const accountId = userData.accountId || `user_${Date.now()}`;
  const customData = {
    accountId: accountId,
    name: userData.name || "Neighbor",
    avatar: userData.avatar || createAvatar(userData.name || "Neighbor"),
    neighborhood: userData.neighborhood || DEFAULT_NEIGHBORHOOD,
    bio: userData.bio || "Proud member of the neighborhood!",
    lastActive: new Date(),
  };

  const userObj = {
    id: accountId,
    accountId: accountId,
    customData: customData,
    accessToken: "mock-valid-access-token",
    functions: {
      setName: async (name) => {
        updateMockUserName(accountId, name);
        userObj.customData.name = name;
        return { success: true };
      },
      setNeighborhood: async (neighborhood) => {
        updateMockUserNeighborhood(accountId, neighborhood);
        userObj.customData.neighborhood = neighborhood;
        return { success: true };
      },
      logUserActive: () => {},
    },
    refreshCustomData: async () => {
      const fresh = getMockUser(accountId);
      if (fresh) {
        userObj.customData = {
          ...userObj.customData,
          name: fresh.name,
          neighborhood: fresh.neighborhood,
          avatar: fresh.avatar,
        };
      }
      return userObj.customData;
    },
    refreshAccessToken: async () => "mock-valid-access-token",
    logOut: async () => {
      removeActiveMockUser();
    },
  };

  return userObj;
};

// Apollo Link implementation to handle GraphQL queries locally
export const createMockApolloLink = () => {
  return new ApolloLink((operation) => {
    return new Observable((observer) => {
      const { operationName, variables } = operation;

      try {
        let resultData = {};

        switch (operationName) {
          case "GetPostsWithAuthors": {
            const posts = getMockPostsWithAuthors({
              placeId: variables?.placeId,
              postType: variables?.postType,
            });
            resultData = { postsWithAuthors: posts };
            break;
          }

          case "GetNeighbors": {
            const neighbors = getMockNeighbors(variables?.placeId);
            resultData = { users: neighbors };
            break;
          }

          case "GetUser": {
            const user = getMockUser(variables?.accountId) || {
              accountId: variables?.accountId,
              name: "Neighbor",
              avatar: createAvatar("Neighbor"),
              lastActive: new Date(),
              neighborhood: DEFAULT_NEIGHBORHOOD,
              bio: "Neighborly community member.",
            };
            resultData = { user };
            break;
          }

          case "GetUserPosts": {
            const userPosts = getMockUserPosts(variables?.accountId);
            resultData = { posts: userPosts };
            break;
          }

          case "InsertOnePost": {
            const inserted = insertMockPost(variables?.data);
            resultData = { insertOnePost: inserted };
            break;
          }

          case "DeleteOnePost": {
            const res = deleteMockPost(variables?.query);
            resultData = { deleteOnePost: res };
            break;
          }

          default:
            console.warn(`Unhandled mock GraphQL operation: ${operationName}`);
            resultData = {};
        }

        // Slight async tick to mimic standard Apollo behavior
        setTimeout(() => {
          observer.next({ data: resultData });
          observer.complete();
        }, 10);
      } catch (err) {
        console.error("Mock GraphQL link error:", err);
        observer.error(err);
      }
    });
  });
};
