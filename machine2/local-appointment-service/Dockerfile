FROM php:8.2-apache

WORKDIR /var/www/html

# Activer mod_rewrite
RUN a2enmod rewrite

# Installer les extensions PHP nécessaires
RUN docker-php-ext-install pdo pdo_mysql

# Copier les fichiers
COPY . /var/www/html/

# Créer le répertoire pour les données
RUN mkdir -p /var/www/html/data && \
    chown -R www-data:www-data /var/www/html

EXPOSE 80


