FROM eclipse-temurin:17-jdk

# Define Mule version
ENV MULE_VERSION=4.7.0
ENV MULE_HOME=/opt/mule

# Install necessary tools
RUN apt-get update && apt-get install -y wget unzip && \
    wget https://repository.mulesoft.org/nexus/content/repositories/releases/org/mule/distributions/mule-standalone/${MULE_VERSION}/mule-standalone-${MULE_VERSION}.tar.gz -O /tmp/mule.tar.gz && \
    tar -xzf /tmp/mule.tar.gz -C /opt && \
    mv /opt/mule-standalone-${MULE_VERSION} /opt/mule && \
    rm /tmp/mule.tar.gz

WORKDIR $MULE_HOME

# Expose port
EXPOSE 8082

# Instructions:
# 1. Build the project in Anypoint Studio.
# 2. Export as Deployable Archive (JAR).
# 3. Place the JAR in the 'apps' folder in this directory.
# 4. Uncomment the line below:
COPY ./apps/esb-local.jar /opt/mule/apps/

# Start Mule
CMD ["./bin/mule"]
