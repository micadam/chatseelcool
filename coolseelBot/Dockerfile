# Use the official Node.js image as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install --omit=dev

# Copy the source code to the working directory
COPY ./dist ./dist

# Set the entrypoint command to run the ts-node-esm executable
CMD node ./dist/coolseelBot.js

# to test the docker image locally and set the env STREAMER to GORGC
# docker build -t coolseelbot .
# docker run -it --rm --name coolseelbot coolseelbot -e STREAMER=GORGC