#!/usr/bin/env node

const fs = require('fs');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const HTPASSWD_FILE = '/app/.htpasswd';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function promptPassword(prompt) {
  return new Promise((resolve) => {
    // Hide input for password
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    process.stdout.write(prompt);
    
    let password = '';
    stdin.on('data', function(ch) {
      ch = ch.toString('utf8');
      
      switch (ch) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.stdout.write('\n');
          process.exit(1);
          break;
        case '\u007f': // backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += ch;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function changePassword() {
  try {
    console.log('🔐 FIO Analyzer Password Change Tool');
    console.log('=====================================\n');

    // Prompt for username
    const username = await new Promise((resolve) => {
      rl.question('Username (default: admin): ', (answer) => {
        resolve(answer.trim() || 'admin');
      });
    });

    // Prompt for password (hidden)
    const password = await promptPassword('New password: ');
    
    if (password.length < 6) {
      console.log('\n❌ Password must be at least 6 characters long');
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await promptPassword('Confirm password: ');
    
    if (password !== confirmPassword) {
      console.log('\n❌ Passwords do not match');
      process.exit(1);
    }

    // Hash the password
    console.log('\n🔨 Hashing password...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create .htpasswd entry
    const htpasswdEntry = `${username}:${hashedPassword}\n`;

    // Write to file
    console.log('📝 Updating .htpasswd file...');
    fs.writeFileSync(HTPASSWD_FILE, htpasswdEntry, 'utf8');

    console.log('✅ Password updated successfully!');
    console.log(`👤 Username: ${username}`);
    console.log('🔄 Restart the application to apply changes.');
    
  } catch (error) {
    console.error('❌ Error changing password:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check if running in Docker container
if (!fs.existsSync('/app')) {
  console.error('❌ This script should be run inside the Docker container');
  console.error('💡 Use: docker exec fio-backend npm run change-password');
  process.exit(1);
}

changePassword();