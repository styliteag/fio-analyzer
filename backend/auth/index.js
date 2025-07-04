const fs = require('fs');
const bcrypt = require('bcryptjs');
const { HTPASSWD_PATH, HTUPLOADERS_PATH } = require('../config');

// Parse htpasswd file
function parseHtpasswd(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: .htpasswd file not found at ${filePath}. Authentication disabled.`);
        return null;
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const users = {};
        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                const [username, hash] = trimmedLine.split(':');
                if (username && hash) {
                    users[username] = hash;
                }
            }
        });
        return Object.keys(users).length > 0 ? users : null;
    } catch (error) {
        console.error(`Error reading .htpasswd file: ${error.message}`);
        return null;
    }
}

// Verify password against hash
function verifyPassword(password, hash) {
    // Handle different hash formats
    if (hash.startsWith('$2y$') || hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
        // Bcrypt format
        return bcrypt.compareSync(password, hash);
    } else if (hash.startsWith('$apr1$')) {
        // Apache MD5 - not implemented, use bcrypt instead
        console.warn('Apache MD5 format not supported, please recreate .htpasswd with bcrypt (-B flag)');
        return false;
    } else {
        // Plain text (insecure)
        return password === hash;
    }
}

// Check if user has admin privileges
function isAdminUser(username, password) {
    const htpasswdUsers = parseHtpasswd(HTPASSWD_PATH);
    if (!htpasswdUsers || !htpasswdUsers[username]) {
        return false;
    }
    
    const hash = htpasswdUsers[username];
    return verifyPassword(password, hash);
}

// Check if user has upload-only privileges
function isUploaderUser(username, password) {
    const htuploadersUsers = parseHtpasswd(HTUPLOADERS_PATH);
    if (!htuploadersUsers || !htuploadersUsers[username]) {
        return false;
    }
    
    const hash = htuploadersUsers[username];
    return verifyPassword(password, hash);
}

// Combined auth checker that works for any valid user
function customAuthChecker(username, password) {
    return isAdminUser(username, password) || isUploaderUser(username, password);
}

// Get user role
function getUserRole(username, password) {
    if (isAdminUser(username, password)) {
        return 'admin';
    } else if (isUploaderUser(username, password)) {
        return 'uploader';
    }
    return null;
}

// Middleware to require admin access
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (!isAdminUser(username, password)) {
        return res.status(401).json({ error: 'Admin access required' });
    }
    
    req.user = { username, role: 'admin' };
    next();
}

// Middleware to require any valid user (admin or uploader)
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    const role = getUserRole(username, password);
    if (!role) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.user = { username, role };
    next();
}

module.exports = {
    parseHtpasswd,
    verifyPassword,
    isAdminUser,
    isUploaderUser,
    customAuthChecker,
    getUserRole,
    requireAdmin,
    requireAuth
};