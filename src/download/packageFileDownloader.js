import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const githubToken = process.env.GITHUB_TOKEN;
const octokit = new Octokit({ auth: githubToken });

const packageFilesDir = path.resolve(process.cwd(), 'packageFiles');
const repositoriesJsonPath = path.resolve(process.cwd(), 'config', 'repositories.json');

// Create the packageFiles directory if it doesn't exist
if (!fs.existsSync(packageFilesDir)) {
    fs.mkdirSync(packageFilesDir);
}

export async function downloadConfigFiles() {
    try {
        const config = JSON.parse(fs.readFileSync(repositoriesJsonPath, 'utf-8'));
        const repositories = config.repositories || [];
        console.log('Repositories:', repositories);

        for (const repo of repositories) {
            const { owner, repo: repoName, configPath } = repo;
            try {
                console.log(`Fetching content from ${owner}/${repoName}/${configPath}`);
                const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}',{
                    owner : owner,
                    repo: repoName,
                    path: configPath,
                });

                const content = Buffer.from(data.content, 'base64').toString('utf-8');
                const filePath = path.join(packageFilesDir, `${owner}-${repoName}-${configPath.replace(/\//g, '-')}`);
                fs.writeFileSync(filePath, content);
                console.log(`Configuration file downloaded and saved for ${owner}/${repoName}.`);
            } catch (error) {
                if (error.status === 404) {
                    console.error(`File not found: ${configPath} in repository ${owner}/${repoName}`);
                } else {
                    console.error(`Error downloading configuration file for ${owner}/${repoName}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error downloading configuration files:', error);
    }
}