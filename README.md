# Neighborly

![Neighborly Logo](/assets/logo-with-text.png)

Neighborly is a community-driven platform that connects people within the same city or neighborhood, allowing them to responsibly borrow, lend, or trade everyday items like tools, vehicles, or extra storage space. It aims to foster a sense of community, promote sustainability, and reduce consumption through resource sharing among neighbors.

## 🏆 Atlas Madness 2023 Grand Prize Winner!

![Atlas Madness 2023 Banner](/assets/hackathon-banner.png)

Neighborly was built as a submission to the **Atlas Madness 2023 Hackathon**, sponsored by Google and MongoDB, where it was awarded the **Grand Prize**!
- 🔗 **Devpost Submission:** [Neighborly on Devpost](https://devpost.com/software/neighborly-42ghs1)
- 🎥 **Video Walkthrough:** [YouTube Demo](https://www.youtube.com/watch?v=3M3PBXroKls)

---

## 🚀 Quickstart

To run Neighborly locally with zero configuration:

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm start
```

3. Open **`http://localhost:3000`** in your browser.
4. Click **"Get started"** or **"Log in"**.
5. Click **"Explore as Peter (Demo)"** for **instant 1-click access** into the full app pre-loaded with realistic neighborhood posts, active neighbors, and categories!

---

## 🛠️ Offline & Demo Engine (2024+ Maintenance Update)

Since this project was built for the 2023 hackathon, two upstream services changed:
1. **MongoDB Atlas App Services (Realm Cloud)** was officially retired and shut down by MongoDB (it now returns an HTTP 410 Gone).
2. The hackathon **Google Cloud Platform billing account** expired, disabling live Google Maps Places Autocomplete and Cloud Functions.

To ensure anyone running this project locally can load, run, and explore every feature of the project without needing active cloud credentials, Neighborly includes a self-contained local engine:
- **Apollo Link Mock Backend:** Intercepts GraphQL queries (`POSTS`, `NEIGHBORS`, `USER`, `USER_POSTS`) and mutations (`INSERT_ONE_POST`, `DELETE_ONE_POST`), resolving them with realistic hackathon seed data.
- **LocalStorage Persistence:** Newly created posts, profile changes, and session state persist across browser reloads.
- **Image Upload Fallback:** Post photos gracefully convert to local data URLs if cloud buckets are unreachable.
- **Location Selector Fallback:** If Google Maps API key is unbilled, an interactive selector provides popular US metro presets (Seattle, Brooklyn, Austin, SF, etc.) plus custom city input.
- **Offline Assets:** Crisp SVG avatars and item graphics load with 0 external network dependencies.

*(Optional)* If you wish to connect to a live MongoDB Realm endpoint instead, set `REACT_APP_USE_REALM_LIVE=true` in your `.env`.

---

## ✨ Features to Explore

- **Categorized Feed:** Switch between **All Posts**, **Lend**, **Borrow**, and **Trade** in the sidebar.
- **Create Posts:** Select post type, write a description, attach photos, and publish to the live feed.
- **Active Neighbors:** View neighbors active in your community on the right sidebar.
- **Neighbor Profiles:** Click on any neighbor (e.g. Peter Rauscher, Sarah Jenkins) to view their profile, bio, location, statistics, and posted items.
- **Neighborhood Switching:** Select your neighborhood from the selector to filter local activity.
- **Contact Page:** Send a message through the contact form with simulated delivery confirmation.

---

## 💻 Tech Stack

- **Frontend:** React 18, React Router v6, Apollo Client GraphQL
- **Styling:** Bulma CSS Framework, Bulmaswatch, Sass, Gulp build pipeline
- **Icons & Media:** Font Awesome, LightGallery React
- **Data & Auth:** Apollo Client GraphQL with local persistence engine and Realm Web compatibility layer

---

## 📦 Project Scripts

| Script | Description |
|---|---|
| `npm start` | Builds Sass & images with Gulp, then starts Webpack dev server on port 3000 |
| `npm run build` | Builds Sass and creates an optimized production bundle in `/build` |
| `npm test` | Runs the test runner |

---

## 📄 License

Neighborly is open-source under the [MIT License](LICENSE).
