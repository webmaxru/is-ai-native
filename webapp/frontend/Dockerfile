# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app
COPY webapp/frontend ./webapp/frontend

ARG FRONTEND_API_ORIGIN=http://localhost:3000
ARG ENABLE_SHARING=false
ARG PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=
ARG SITE_ORIGIN=http://localhost:8080
ENV FRONTEND_API_ORIGIN=$FRONTEND_API_ORIGIN
ENV ENABLE_SHARING=$ENABLE_SHARING
ENV PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=$PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING
ENV SITE_ORIGIN=$SITE_ORIGIN

RUN node webapp/frontend/scripts/build.mjs

FROM nginx:1.28-alpine

COPY webapp/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/webapp/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --spider http://localhost/ || exit 1
