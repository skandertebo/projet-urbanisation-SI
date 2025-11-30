FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY server.js ./

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "server.js"]
