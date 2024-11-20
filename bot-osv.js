import fetch from 'node-fetch';
import { Client, GatewayIntentBits } from 'discord.js';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const token = process.env.DISCORD_TOKEN;
const githubToken = process.env.GITHUB_TOKEN;

const octokit = new Octokit({ auth: githubToken });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configDir = path.join(__dirname, 'configs');
const sentVulnsFile = path.join(__dirname, 'sent_vulns.json');

// Create the configs directory if it doesn't exist
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

// Create the sent_vulns.json file if it doesn't exist
if (!fs.existsSync(sentVulnsFile)) {
    fs.writeFileSync(sentVulnsFile, JSON.stringify({}));
}

bot.on('ready', async () => {
    console.log(`Logged in as ${bot.user.tag}!`);
    await downloadConfigFiles();
    checkVulnerabilities();
    setInterval(checkVulnerabilities, process.env.REFRESH_TIME * 1000); // Check every hour (3600000 ms)
});

async function downloadConfigFiles() {
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
            console.log(`Configuration file downloaded and saved for ${owner}/${repoName}.`);
        }
    } catch (error) {
        console.error('Error downloading configuration files:', error);
    }
}

async function checkVulnerabilities() {
    console.log('Checking for vulnerabilities...');
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    const repositories = config.repositories || []; // Fixed: Was config.json
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
                console.log(`Checking vulnerabilities for ${packageName} (${version})`);
                let requestBody;
                if (configPath.endsWith('package-lock.json')) {
                    requestBody = {
                        version: version.replace(/^[^0-9]*/, ''), // Remove non-numeric characters at the beginning of the version
                        package: {
                            name: packageName,
                            ecosystem: ecosystem
                        }
                    };
                } else if (configPath.endsWith('composer.lock')) {
                    requestBody = {
                        version: version.replace(/[^a-zA-Z0-9.]/g, ''), // Remove non-alphanumeric characters except dots
                        package: {
                            name: packageName,
                            ecosystem: ecosystem
                        }
                    };
                }
                console.log('Request sent to OSV API:', requestBody);
                const response = await fetch(`https://api.osv.dev/v1/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });
                const data = await response.json();
                console.log(`Response from OSV API for ${packageName} (${version}):`, data);
                if (data.vulns && data.vulns.length > 0) {
                    // There are new vulnerabilities
                    for (const vuln of data.vulns) {
                        const vulnId = vuln.id;
                        if (sentVulns[vulnId] && sentVulns[vulnId] > oneWeekAgo) {
                            console.log(`Vulnerability ${vulnId} already sent less than a week ago.`);
                            continue;
                        }
                        const userId = process.env.DISCORD_USER_ID;
                        let message = `# 🚨 <@${userId}> **New vulnerability for ${packageName} (${ecosystem}) in ${owner}/${repoName} :**\n`;
                        message += `## 🔗 [${vuln.id}](https://osv.dev/vulnerability/${vuln.id}): ${vuln.summary}\n`;
                        message += `## 📝 **Details:**\n${vuln.details.replace(/https?:\/\/[^\s]+/g, match => `<${match.slice(0, -1)}>${match.slice(-1)}`).replace(/####/g, '###')}\n\n\n`;
                        message += `## 🔗 **References:**\n`;
                        for (const ref of vuln.references || []) {
                            message += `• <${ref.url}>\n`;
                        }
                        message += `\n`;
                        message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`; // Added separator
                        // Send the message for each vulnerability
                        await channel.send(message);
                        // Update the sent_vulns.json file
                        sentVulns[vulnId] = Date.now();
                        fs.writeFileSync(sentVulnsFile, JSON.stringify(sentVulns, null, 2));
                    }
                } else {
                    console.log(`No vulnerabilities found for ${packageName} (${version})`);
                }
            } catch (error) {
                console.error('Error checking vulnerabilities for', packageName, version, ':', error);
            }
        }
    }
}

bot.login(token);