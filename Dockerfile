FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 TIDYMARK_PUBLIC=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
USER node
CMD ["node", "server/index.mjs"]
