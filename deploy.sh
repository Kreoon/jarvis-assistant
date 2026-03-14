#!/bin/bash
# Deploy script for Contabo VPS
# Run this ON your VPS

set -e

echo "🚀 Deploying Jarvis..."

# Install Node.js 20 if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Clone or pull the project
PROJECT_DIR="$HOME/jarvis-assistant"
if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    git pull
else
    echo "Please clone your project repo to $PROJECT_DIR first"
    exit 1
fi

# Install dependencies and build
npm install
npm run build

# Start or restart with PM2
pm2 stop jarvis 2>/dev/null || true
pm2 start dist/index.js --name jarvis
pm2 save
pm2 startup

echo ""
echo "✅ Jarvis deployed!"
echo ""
echo "Next steps:"
echo "1. Make sure your .env file is configured at $PROJECT_DIR/.env"
echo "2. Set up Nginx reverse proxy (see nginx.conf)"
echo "3. Configure your webhook URL in Meta Developer Console"
echo ""
