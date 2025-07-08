module.exports = [
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                console: "readonly",
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                module: "readonly",
                require: "readonly",
                exports: "readonly",
                global: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearTimeout: "readonly",
                clearInterval: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-console": "off",
            "semi": ["error", "always"],
            "no-trailing-spaces": "warn",
            "eol-last": "warn"
        }
    }
];
