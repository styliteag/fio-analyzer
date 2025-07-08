#!/usr/bin/env node

const fs = require('fs');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const HTUPLOADERS_FILE = '.htuploaders';

console.log('🔐 FIO Analyzer Uploader User Management Tool');
console.log('=============================================\n');

// Hidden password input function
function getHiddenPassword(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    // Check if stdin has setRawMode (TTY)
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let password = '';

      const onData = (char) => {
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(password);
            break;
          case '\u0003': // Ctrl+C
            process.stdout.write('\n');
            process.exit(1);
            break;
          case '\u007f': // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            password += char;
            process.stdout.write('*');
            break;
        }
      };

      process.stdin.on('data', onData);
    } else {
      // Fallback for non-TTY environments
      console.log('\n⚠️  Warning: Running in non-TTY mode - password will be visible!');
      console.log('💡 For secure password input, use: docker exec -it fio-app npm run manage-uploaders');
      console.log('💡 Or use non-interactive mode: node scripts/manage-uploaders.js username password\n');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(prompt, (password) => {
        rl.close();
        resolve(password);
      });
    }
  });
}

async function main() {
  try {
    // Check for command line arguments
    const args = process.argv.slice(2);
    let username, password;

    if (args.length >= 2) {
      // Non-interactive mode: username and password from command line
      username = args[0];
      password = args[1];
      console.log(`👤 Username: ${username}`);
      console.log('🔑 Password provided via command line');
    } else {
      // Interactive mode
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Get username
      username = await new Promise((resolve) => {
        rl.question('Uploader username: ', (answer) => {
          resolve(answer.trim());
        });
      });

      if (!username) {
        console.log('❌ Username is required');
        process.exit(1);
      }

      rl.close();

      // Get password with hidden input
      password = await getHiddenPassword('New password: ');

      if (password && password.length >= 3) {
        const confirmPassword = await getHiddenPassword('Confirm password: ');

        if (password !== confirmPassword) {
          console.log('❌ Passwords do not match');
          process.exit(1);
        }
      }
    }

    if (!password || password.length < 3) {
      console.log('❌ Password must be at least 3 characters long');
      process.exit(1);
    }

    // Hash the password
    console.log('🔨 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update .htuploaders file while preserving other users
    console.log('📝 Updating .htuploaders file...');

    let existingContent = '';
    if (fs.existsSync(HTUPLOADERS_FILE)) {
      existingContent = fs.readFileSync(HTUPLOADERS_FILE, 'utf8');
    }

    const lines = existingContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const userExists = lines.findIndex(line => line.startsWith(`${username}:`));

    if (userExists !== -1) {
      // Update existing user
      lines[userExists] = `${username}:${hashedPassword}`;
      console.log(`👤 Updated existing uploader '${username}'`);
    } else {
      // Add new user
      lines.push(`${username}:${hashedPassword}`);
      console.log(`👤 Added new uploader '${username}'`);
    }

    // Write back to file with preserved structure
    const newContent = lines.join('\n') + '\n';
    fs.writeFileSync(HTUPLOADERS_FILE, newContent, 'utf8');

    console.log('✅ Uploader user updated successfully!');
    console.log(`👤 Username: ${username}`);
    console.log('📁 Role: Upload-only (can only upload FIO test data)');
    console.log('🔄 Restart the application to apply changes.');

  } catch (error) {
    console.error('❌ Error managing uploader user:', error.message);
    process.exit(1);
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage:');
  console.log('  Interactive mode:     docker exec -it fio-app npm run manage-uploaders');
  console.log('  Non-interactive mode: docker exec fio-app node scripts/manage-uploaders.js username password');
  console.log('  Help:                 npm run manage-uploaders --help');
  console.log('');
  console.log('Examples:');
  console.log('  docker exec fio-app node scripts/manage-uploaders.js testuser testpass');
  console.log('  docker exec fio-app node scripts/manage-uploaders.js uploader1 secretpass');
  console.log('');
  console.log('Note: Uploader users can only upload FIO test data via /api/import');
  console.log('      They cannot view, edit, or delete existing test data.');
  process.exit(0);
}

// Check if running in Docker container
if (!fs.existsSync('/app')) {
  console.error('❌ This script should be run inside the Docker container');
  console.error('💡 Use: docker exec -it fio-app npm run manage-uploaders');
  console.error('💡 Or:   docker exec fio-app node scripts/manage-uploaders.js username password');
}

main();
