# 🛡️ VulnWatcher - Discord Bot for Vulnerability Detection

![Node.js](https://img.shields.io/badge/Node.js-Latest-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![Discord.js](https://img.shields.io/badge/Discord.js-v13.6.0-blueviolet)

## 📖 Description

VulnWatcher is a Discord bot that checks for vulnerabilities in packages in your Node and Symfony applications from the desired GitHub repositories. It sends notifications to a specified Discord channel when it detects new vulnerabilities.

This program uses [OSV](https://google.github.io/osv.dev/), a service by Google that provides an open-source vulnerability database and an API to query these vulnerabilities.

## 🚀 Features

- Checks for vulnerabilities in npm and Packagist packages.
- Sends notifications on Discord for new vulnerabilities.
- Stores sent vulnerabilities to avoid duplicates (re-send notification if previous notification is > 1 week).
- Easy configuration via a `.env.local` file.

## 🤖 Discord Developer Portal Setup 

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. New Application
3. Setup Name and accept the Discord Developer Terls of Service and Developer Policy.
4. Go to "Installation" in the right nav bar
5. Scroll down and search "Guild Install"
6. click on scopes and select bot
7. click on permissions, search for "Send Messages" and click on it
8. click on "Save Changes" (the big green button in the bottom)
9. Go to bot in the right nav bar
10. click on "Reset Token"
11. COPY IT AND KEEP IT SOMEWHERE YOU NOT GONNA LOSE IT

Now you get two choise to install the bot, with Docker or without.

## 🐳 Installation with Docker (recommanded)

### Prerequisites

- [Docker](https://www.docker.com/)

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/AxelRhul/vulnwatcher.git
   cd bot-osv
   ```

2. Create a `.env.local` file at the root of the project and add your environment variables :

   ```env
   DISCORD_TOKEN = "your_discord_bot_token"
   GITHUB_TOKEN = "your_github_token"
   DISCORD_CHANNEL_ID = "your_discord_channel_id"
   DISCORD_USER_ID = "your_discord_user_id"
   REFRESH_TIME = 3600 
   ```

3. Make sure the `config.json` and `sent_vulns.json` files exist in the project root :

   - `config.json` :

     ```json
     {
       "repositories": [
         {
           "owner": "your_github_owner",
           "repo": "your_github_repo",
           "configPath": "path/to/your/config/file"
         }
       ]
     }
     ```

   - `sent_vulns.json` :

     ```json
     {}
     ```

4. Build and start the Docker container :

   ```bash
   docker-compose build
   docker-compose up -d
   ```

## 🛠️ Installation without Docker

### Prerequisites

- [Node.js](https://nodejs.org/) (>= v23.2.0)

### Steps

1. Install [pm2](https://pm2.keymetrics.io/docs/usage/quick-start/) :

```bash
npm i -g pm2
```

2. Clone the repository :

```bash
git clone https://github.com/AxelRhul/vulnwatcher.git
cd bot-osv
```

3. Create a `.env.local` file at the root of the project and add your environment variables :

```env
DISCORD_TOKEN=your_discord_token
GITHUB_TOKEN=your_github_token
DISCORD_CHANNEL_ID=your_discord_channel_id
REFRESH_TIME=3600
```

4. Make sure the `config.json` file exists at the root of the project:

- `config.json` :

```json
{
"repositories": [
{
"owner": "your_github_owner",
"repo": "your_github_repo",
"configPath": "path/to/your/config/file"
}
]
}
```

5. Start the application using pm2 :

```bash
pm2 start bot-osv.js
```

## 📂 Project Structure

```plaintext
.
├── Dockerfile
├── docker-compose.yml
├── index.js
├── package.json
├── package-lock.json
├── .env.local
├── config.json
└── sent_vulns.json
```

## 📜 License

This project is licensed under the MIT License. See the LICENSE file for more details.

