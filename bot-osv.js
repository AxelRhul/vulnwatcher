import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { downloadConfigFiles } from './src/download/packageFileDownloader.js';
import { checkVulnerabilities } from './src/core/vulnerabilityScanner.js';
import { sendVulnerabilityNotification } from './src/notification/discordNotifier.js';
import fs from "fs";

dotenv.config({ path: '.env.local' });

const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const token = process.env.DISCORD_TOKEN;
const sentVulnsFile = './config/sent_vulns.json';

// Create the sent_vulns.json file if it doesn't exist
if (!fs.existsSync(sentVulnsFile)) {
    fs.writeFileSync(sentVulnsFile, JSON.stringify({}));
}

bot.on('ready', async () => {
    console.log(`Logged in as ${bot.user.tag}!`);
    await downloadConfigFiles();
    await checkAndNotifyVulnerabilities();
    setInterval(checkAndNotifyVulnerabilities, process.env.REFRESH_TIME * 1000); // Check every hour (3600000 ms)
});

async function checkAndNotifyVulnerabilities() {
    const sentVulns = JSON.parse(fs.readFileSync(sentVulnsFile, 'utf-8'));
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const vulnerabilities = await checkVulnerabilities();

    for (const vuln of vulnerabilities) {
        const { id: vulnId, packageName, ecosystem, owner, repoName } = vuln;
        if (sentVulns[vulnId] && sentVulns[vulnId] > oneWeekAgo) {
            console.log(`Vulnerability ${vulnId} already sent less than a week ago.`);
            continue;
        }
        await sendVulnerabilityNotification(bot, vuln, packageName, ecosystem, owner, repoName);
        sentVulns[vulnId] = Date.now();
        fs.writeFileSync(sentVulnsFile, JSON.stringify(sentVulns, null, 2));
    }
}

bot.login(token);