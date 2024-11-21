export async function sendVulnerabilityNotification(bot, vuln, packageName, ecosystem, owner, repoName) {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    const channel = bot.channels.cache.get(channelId);
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

    await channel.send(message);
}