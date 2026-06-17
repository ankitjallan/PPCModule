/**
 * Bump patch version in root package.json, stage, commit, and push.
 * Usage: node scripts/release.js [patch|minor|major] ["optional message"]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);

const bump = process.argv[2] || 'patch';
let newVersion;
if (bump === 'major') newVersion = `${major + 1}.0.0`;
else if (bump === 'minor') newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const msg = process.argv[3] || `chore: bump version to v${newVersion}`;

try {
  execSync('git add package.json', { cwd: root, stdio: 'inherit' });
  execSync(`git commit --amend --no-edit`, { cwd: root, stdio: 'inherit' });
  console.log(`\n✅ Version bumped to v${newVersion} and amended into last commit`);
  console.log(`   Run: git push origin main --force-with-lease`);
} catch {
  // No prior commit to amend — make a fresh version bump commit
  execSync(`git commit -m "${msg}"`, { cwd: root, stdio: 'inherit' });
  console.log(`\n✅ Version bump commit: v${newVersion}`);
}
