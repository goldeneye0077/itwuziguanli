FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm config set registry https://registry.npmmirror.com \
    && npm config set strict-ssl false \
    && npm install --no-save vite@^5.4.14 \
    && npx vite build

FROM nginx:1.24-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
