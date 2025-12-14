# MuleSoft ESB Local

This project contains the Mule configuration for the Local ESB.

## Setup in Anypoint Studio

1. Open Anypoint Studio.
2. Create a new Mule Project named `esb-local`.
3. Copy the content of `esb-local.xml` into `src/main/mule/esb-local.xml` (or overwrite the default file).
4. Ensure the HTTP Listener is configured for port 8082.
5. Run the project locally to test.

## Deployment to Docker

1. In Anypoint Studio, right-click the project -> Export -> Anypoint Studio Project to Deployable Archive (JAR).
2. Save the file as `esb-local.jar`.
3. Create a folder named `apps` in this directory.
4. Place `esb-local.jar` in the `apps` folder.
5. Uncomment the `COPY` line in the `Dockerfile`.
6. Run `docker-compose up --build`.
