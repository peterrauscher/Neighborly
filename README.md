# Neighborly

![Neighborly Logo](/assets/logo-with-text.png)

Neighborly is a community-driven platform that connects people within the same city or neighborhood, allowing them to responsibly borrow, lend, or trade various items like tools, vehicles, or extra storage space. It aims to foster a sense of community, promote sustainability, and reduce waste and consumption by facilitating resource sharing among neighbors.

## We're Live!

Check out the live version of Neighborly at [beneighborly.xyz](https://beneighborly.xyz).

## Technologies Used

- [MongoDB Atlas](https://www.mongodb.com/atlas) - MongoDB's serverless database and application service. I used the built in user authentication methods, a databse cluster with custom GraphQL resolvers, and the serverless Functions feature.
- [Google Cloud Storage](https://cloud.google.com/storage) - Cloud storage buckets are used for hosting images that users upload along with their posts.
- [Google Cloud Functions](https://cloud.google.com/functions) - A serverless compute platform for running event-driven functions in the cloud.
- [Google Cloud Build & Google Cloud Run](https://cloud.google.com/run) - Used to deploy the Dockerized version of this app to the cloud, without the need to manage infrastructure. The custom domains feature was used to link to [beneighborly.xyz](https://beneighborly.xyz)!
- [Create React App w/ Apollo Client](https://create-react-app.dev) - A popular tool for bootstrapping React applications. Apollo is used to interface with the GraphQL API.

## Local Development Setup

To run Neighborly locally, follow these steps:

1. Clone the repository: `git clone https://github.com/peterrauscher/Neighborly.git`
2. Navigate to the project directory: `cd Neighborly`
3. Install the dependencies: `npm install`
4. Start the development server: `npm start`
5. Open your browser and visit `http://localhost:3000` to view Neighborly.

> **Note:** Details about running with your own Atlas and Google Cloud instances coming soon. Right now, things are hardcoded to use my own infrastructure.

## Deployment

Neighborly is deployed using Google Cloud Run and can be accessed at [https://beneighborly.xyz](https://beneighborly.xyz). The deployment process involves building a Docker container and deploying it to Google Cloud Run. Make sure you have the necessary permissions and credentials set up to deploy the application to Google Cloud.

To deploy Neighborly:

1. Build the Docker image: `docker build -t neighborly .`
2. Tag the image with the Google Container Registry URL: `docker tag neighborly gcr.io/[project-id]/neighborly`
3. Push the image to the Google Container Registry: `docker push gcr.io/[project-id]/neighborly`
4. Deploy the container to Google Cloud Run: `gcloud run deploy --image gcr.io/[project-id]/neighborly --platform managed`

Follow the prompts and configure the necessary settings during the deployment process.

## Contributing

We welcome contributions to Neighborly! If you have any ideas, suggestions, or bug reports, please submit an issue or open a pull request. Make sure to follow the [contributing guidelines](CONTRIBUTING.md) when contributing to this project.

## License

Neighborly is released under the [MIT License](LICENSE). Feel free to use, modify, and distribute the code as per the terms of the license.

---

Thank you for your interest in Neighborly! We hope this platform brings communities closer together and promotes responsible resource sharing. If you have any questions or need assistance, please don't hesitate to reach out to our support team at [support@beneighborly.xyz](mailto:support@beneighborly.xyz).
