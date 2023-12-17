# Use the official Node.js image as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install --omit=dev

# copy the prisma schema and generate the prisma client
COPY ./prisma ./prisma
# write the postgres url into .env
RUN echo "DATABASE_URL=postgresql://coolseel:password@db:5432/coolseel" > .env
RUN npx prisma generate

# Copy the source code to the working directory
COPY ./dist ./dist

# Set the entrypoint command to run the ts-node-esm executable
ENTRYPOINT ["node", "./dist/src/coolseelBot.js"]


# to test the docker image locally and set the env STREAMER to GORGC
# docker build -t coolseelbot .
# docker run -it --rm --name coolseelbot coolseelbot -e STREAMER=GORGC