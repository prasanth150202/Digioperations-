FROM php:8.2-apache

# Enable Apache mod_rewrite for our .htaccess routing
RUN a2enmod rewrite

# Install required PHP extensions (PDO MySQL for database connections)
RUN docker-php-ext-install pdo pdo_mysql

# Set the working directory to the Apache web root
WORKDIR /var/www/html

# We don't need to copy files here because we use a volume in docker-compose,
# but it's good practice for production builds.
# COPY . /var/www/html/

# Update the default apache config to AllowOverride All so .htaccess works
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
