# Utiliser la version la plus récente de l'image Node.js officielle comme image de base
FROM node:latest

# Définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copier package.json et package-lock.json dans le répertoire de travail
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers de l'application dans le répertoire de travail
COPY . .

# Commande pour démarrer l'application
CMD ["node", "bot-osv.js"]