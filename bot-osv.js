import fetch from 'node-fetch';
import { Client, GatewayIntentBits } from 'discord.js';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';


dotenv.config({ path: '.env.local' });
const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const token = process.env.DISCORD_TOKEN; // Utiliser la variable d'environnement pour le token Discord
const githubToken = process.env.GITHUB_TOKEN;

const octokit = new Octokit({ auth: githubToken });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configDir = path.join(__dirname, 'configs');
const sentVulnsFile = path.join(__dirname, 'sent_vulns.json');

// Créez le répertoire configs s'il n'existe pas
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

// Créez le fichier sent_vulns.json s'il n'existe pas
if (!fs.existsSync(sentVulnsFile)) {
    fs.writeFileSync(sentVulnsFile, JSON.stringify({}));
}

bot.on('ready', async () => {
    console.log(`Connecté en tant que ${bot.user.tag}!`);
    await telechargerFichiersConfiguration();
    verifierVulnerabilites();
    setInterval(verifierVulnerabilites, process.env.REFRESH_TIME * 1000); // Vérifier toutes les heures (3600000 ms)
});

async function telechargerFichiersConfiguration() {
    try {
        const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        const repositories = config.repositories || [];

        for (const repo of repositories) {
            const { owner, repo: repoName, configPath } = repo;
            const { data } = await octokit.repos.getContent({
                owner,
                repo: repoName,
                path: configPath,
            });

            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            const filePath = path.join(configDir, `${owner}-${repoName}-${configPath.replace(/\//g, '-')}`);
            fs.writeFileSync(filePath, content);
            console.log(`Fichier de configuration téléchargé et sauvegardé pour ${owner}/${repoName}.`);
        }
    } catch (error) {
        console.error('Erreur lors du téléchargement des fichiers de configuration :', error);
    }
}

async function verifierVulnerabilites() {
    console.log('Vérification des vulnérabilités...');
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    const repositories = config.repositories || [];
    const sentVulns = JSON.parse(fs.readFileSync(sentVulnsFile, 'utf-8'));
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    const channel = bot.channels.cache.get(channelId);
    

    for (const repo of repositories) {
        const { owner, repo: repoName, configPath } = repo;
        const repoConfigPath = path.join(configDir, `${owner}-${repoName}-${configPath.replace(/\//g, '-')}`);
        const repoConfig = JSON.parse(fs.readFileSync(repoConfigPath, 'utf-8'));

        let packages = [];
        let ecosystem = '';

        if (configPath.endsWith('package-lock.json')) {
            packages = Object.entries(Object.entries(repoConfig.packages)[0][1].dependencies);
            ecosystem = 'npm';
        } else if (configPath.endsWith('composer.lock')) {
            for (const packageData of repoConfig.packages) {
                packages.push([packageData.name, packageData.version]);
            }
            ecosystem = 'Packagist';
        }

        for (const [packageName, version] of packages) {
            try {
                console.log(`Vérification des vulnérabilités pour ${packageName} (${version})`);
                let requestBody;
                if (configPath.endsWith('package-lock.json')) {
                    requestBody = {
                        version: version.replace(/^[^0-9]*/, ''), // Enlever les caractères non numériques au début de la version
                        package: {
                            name: packageName,
                            ecosystem: ecosystem
                        }
                    };
                } else if (configPath.endsWith('composer.lock')) {
                    requestBody = {
                        version: version.replace(/[^a-zA-Z0-9.]/g, ''), // Enlever les caractères non alphanumériques sauf les points
                        package: {
                            name: packageName,
                            ecosystem: ecosystem
                        }
                    };
                }
                console.log('Requête envoyée à l\'API OSV:', requestBody);
                const response = await fetch(`https://api.osv.dev/v1/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });
                const data = await response.json();
                console.log(`Réponse de l'API OSV pour ${packageName} (${version}):`, data);
                if (data.vulns && data.vulns.length > 0) {
                    // Il y a de nouvelles vulnérabilités
                    for (const vuln of data.vulns) {
                        const vulnId = vuln.id;
                        if (sentVulns[vulnId] && sentVulns[vulnId] > oneWeekAgo) {
                            console.log(`Vulnérabilité ${vulnId} déjà envoyée il y a moins d'une semaine.`);
                            continue;
                        }
                        const userId = process.env.DISCORD_USER_ID;
                        let message = `# 🚨 <@${userId}> **Nouvelle vulnérabilité pour ${packageName} (${ecosystem}) dans ${owner}/${repoName} :**\n`;
                        message += `## 🔗 [${vuln.id}](https://osv.dev/vulnerability/${vuln.id}): ${vuln.summary}\n`;
                        message += `## 📝 **Détails:**\n${vuln.details.replace(/https?:\/\/[^\s]+/g, match => `<${match.slice(0, -1)}>${match.slice(-1)}`).replace(/####/g, '###')}\n\n\n`;
                        message += `## 🔗 **Références:**\n`;
                        for (const ref of vuln.references || []) {
                            message += `• <${ref.url}>\n`;
                        }
                        message += `\n`;
                        message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`; // Ajout du séparateur
                        // Envoyer le message pour chaque vulnérabilité
                        await channel.send(message);
                        // Mettre à jour le fichier sent_vulns.json
                        sentVulns[vulnId] = Date.now();
                        fs.writeFileSync(sentVulnsFile, JSON.stringify(sentVulns, null, 2));
                    }
                } else {
                    console.log(`Aucune vulnérabilité trouvée pour ${packageName} (${version})`);
                }
            } catch (error) {
                console.error('Erreur lors de la vérification des vulnérabilités pour', packageName, version, ':', error);
            }
        }
    }
}

bot.login(token);