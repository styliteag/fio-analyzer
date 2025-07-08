const fs = require('fs');
const bcrypt = require('bcryptjs');
const { HTPASSWD_PATH, HTUPLOADERS_PATH } = require('../config');
const { logInfo, logError, logWarning } = require('../utils');

// Parse htpasswd file
function parseHtpasswd(filePath) {
    if (!fs.existsSync(filePath)) {
        logWarning(`htpasswd file not found`, { filePath });
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

        const userCount = Object.keys(users).length;
        logInfo('htpasswd file parsed successfully', {
            filePath,
            userCount,
            users: Object.keys(users)
        });

        return userCount > 0 ? users : null;
    } catch (error) {
        logError('Error reading htpasswd file', error, { filePath });
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
        logWarning('Apache MD5 format not supported', {
            suggestion: 'Please recreate .htpasswd with bcrypt (-B flag)'
        });
        return false;
    } else {
        // Plain text (insecure)
        logWarning('Using plain text password (insecure)', {
            suggestion: 'Please use bcrypt hashed passwords'
        });
        return password === hash;
    }
}

// Check if user has admin privileges
function isAdminUser(username, password) {
    const htpasswdUsers = parseHtpasswd(HTPASSWD_PATH);
    if (!htpasswdUsers || !htpasswdUsers[username]) {
        logInfo('Admin authentication failed', {
            username,
            reason: !htpasswdUsers ? 'no_htpasswd_file' : 'user_not_found'
        });
        return false;
    }

    const hash = htpasswdUsers[username];
    const isValid = verifyPassword(password, hash);

    logInfo('Admin authentication attempt', {
        username,
        success: isValid
    });

    return isValid;
}

// Check if user has upload-only privileges
function isUploaderUser(username, password) {
    const htuploadersUsers = parseHtpasswd(HTUPLOADERS_PATH);
    if (!htuploadersUsers || !htuploadersUsers[username]) {
        logInfo('Uploader authentication failed', {
            username,
            reason: !htuploadersUsers ? 'no_htuploaders_file' : 'user_not_found'
        });
        return false;
    }

    const hash = htuploadersUsers[username];
    const isValid = verifyPassword(password, hash);

    logInfo('Uploader authentication attempt', {
        username,
        success: isValid
    });

    return isValid;
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
        logInfo('Admin access denied - no auth header', {
            requestId: req.requestId,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Authentication required' });
    }

    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (!isAdminUser(username, password)) {
        logInfo('Admin access denied - invalid credentials', {
            requestId: req.requestId,
            username,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Admin access required' });
    }

    logInfo('Admin access granted', {
        requestId: req.requestId,
        username,
        ip: req.ip || req.connection.remoteAddress
    });

    req.user = { username, role: 'admin' };
    next();
}

// Middleware to require any valid user (admin or uploader)
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        logInfo('Authentication denied - no auth header', {
            requestId: req.requestId,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Authentication required' });
    }

    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    const role = getUserRole(username, password);
    if (!role) {
        logInfo('Authentication denied - invalid credentials', {
            requestId: req.requestId,
            username,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    logInfo('Authentication successful', {
        requestId: req.requestId,
        username,
        role,
        ip: req.ip || req.connection.remoteAddress
    });

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
