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
EXPOSE 8081

# Copy the application
COPY ./apps/esb-central.jar /opt/mule/apps/

# Start Mule
CMD ["./bin/mule"]
