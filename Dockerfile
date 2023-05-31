# build environment
FROM node:16.18.1 as build
WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY . ./

RUN npm ci
RUN npm install react-scripts@5.0.1 -g

RUN npm run build

# production environment
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]