# build environment
FROM node:16.18.1-alpine as react-build
WORKDIR /app

COPY . ./

RUN npm ci

RUN npm run build

# server environment
FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/configfile.template

COPY --from=react-build /app/build /usr/share/nginx/html

ENV PORT 8080
ENV HOST 0.0.0.0
EXPOSE 8080
CMD sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/configfile.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"