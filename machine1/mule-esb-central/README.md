# MuleSoft ESB Central

This project contains the Mule configuration for the Central ESB.

## Setup in Anypoint Studio

1. Open Anypoint Studio.
2. Create a new Mule Project named `esb-central`.
3. Copy the content of `esb-central.xml` into `src/main/mule/esb-central.xml` (or overwrite the default file).
4. Ensure the HTTP Listener is configured for port 8081.
5. Run the project locally to test.

## Deployment to Docker

1. In Anypoint Studio, right-click the project -> Export -> Anypoint Studio Project to Deployable Archive (JAR).
2. Save the file as `esb-central.jar`.
3. Create a folder named `apps` in this directory.
4. Place `esb-central.jar` in the `apps` folder.
5. Uncomment the `COPY` line in the `Dockerfile`.
6. Run `docker-compose up --build`.
