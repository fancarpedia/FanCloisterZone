// Version 2

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');


function exec(command) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error executing: ${command}`);
    process.exit(1);
  }
}

function getVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function main() {
  console.log('Starting release process...\n');

  // Get current branch
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  console.log(`Current branch: ${branch}\n`);

  // Check if there are changes to commit
//  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  
//  if (status) {
//    console.log('Committing changes...');
//    exec('git add .');
//    exec('git commit -m "chore: release"');
//  } else {
//    console.log('No changes to commit.\n');
//  }

  // Get version from package.json
  const version = getVersion();
  console.log(`Version from package.json: ${version}\n`);

  // Check if tag already exists
  try {
    const existingTags = execSync('git tag -l', { encoding: 'utf8' });
    if (existingTags.split('\n').includes(`v${version}`)) {
      console.error(`❌ Error: Tag v${version} already exists!`);
      console.error('Please update the version in package.json before releasing.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking existing tags');
    process.exit(1);
  }

  // Pull all previous changes
  console.log(`Pull changes for ${branch}`);
  exec(`git pull`);

  // Create tag
  console.log(`Creating tag v${version}...`);
  exec(`git tag -a v${version} -m "Release v${version}"`);

  // Push branch and tags
  console.log('\nPushing to origin...');
  exec(`git push origin ${branch}`);
  exec(`git push origin v${version}`);

  console.log('\n✅ Release complete!');
  console.log(`Tagged and pushed v${version} to origin`);
}

main();