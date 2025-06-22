# Deployment Guide

This guide covers different deployment options for the Unit Talk Discord Bot.

## 🚀 Quick Start (Local Development)

### Option 1: Using Setup Scripts

**Windows:**
```cmd
cd unit-talk-custom-bot
setup.bat
```

**Linux/macOS:**
```bash
cd unit-talk-custom-bot
./setup.sh
```

### Option 2: Manual Setup

```bash
cd unit-talk-custom-bot
npm install
cp .env.example .env
# Edit .env with your configuration
npm run build
npm run dev  # Development mode
# OR
npm start    # Production mode
```

## 🐳 Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- Configured `.env` file

### Single Container
```bash
# Build the image
docker build -t unit-talk-bot .

# Run the container
docker run -d \
  --name unit-talk-bot \
  --env-file .env \
  -p 3000:3000 \
  unit-talk-bot
```

### Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f unit-talk-bot

# Stop services
docker-compose down
```

## ☁️ Cloud Deployment

### Heroku

1. **Create Heroku App:**
   ```bash
   heroku create your-bot-name
   ```

2. **Set Environment Variables:**
   ```bash
   heroku config:set DISCORD_TOKEN=your_token
   heroku config:set DISCORD_CLIENT_ID=your_client_id
   # ... set all required variables
   ```

3. **Deploy:**
   ```bash
   git push heroku main
   ```

4. **Scale:**
   ```bash
   heroku ps:scale worker=1
   ```

### Railway

1. **Connect Repository:**
   - Go to [Railway](https://railway.app)
   - Connect your GitHub repository

2. **Set Environment Variables:**
   - Add all variables from `.env.example`

3. **Deploy:**
   - Railway will automatically deploy on push

### DigitalOcean App Platform

1. **Create App:**
   - Go to DigitalOcean App Platform
   - Connect your repository

2. **Configure:**
   - Set environment variables
   - Choose appropriate plan

3. **Deploy:**
   - App Platform handles deployment automatically

## 🖥️ VPS/Server Deployment

### Using PM2 (Recommended)

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Create PM2 Ecosystem File:**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'unit-talk-bot',
       script: 'dist/index.js',
       instances: 1,
       autorestart: true,
       watch: false,
       max_memory_restart: '1G',
       env: {
         NODE_ENV: 'production'
       }
     }]
   };
   ```

3. **Deploy:**
   ```bash
   npm run build
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

### Using systemd

1. **Create Service File:**
   ```ini
   # /etc/systemd/system/unit-talk-bot.service
   [Unit]
   Description=Unit Talk Discord Bot
   After=network.target

   [Service]
   Type=simple
   User=your-user
   WorkingDirectory=/path/to/unit-talk-custom-bot
   ExecStart=/usr/bin/node dist/index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and Start:**
   ```bash
   sudo systemctl enable unit-talk-bot
   sudo systemctl start unit-talk-bot
   sudo systemctl status unit-talk-bot
   ```

## 🔧 Environment-Specific Configuration

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
DISCORD_GUILD_ID=your_test_guild_id  # For faster command deployment
```

### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
# Use staging database and Discord server
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
# Remove DISCORD_GUILD_ID for global commands
# Use production database and Discord server
```

## 📊 Monitoring and Maintenance

### Health Checks
```bash
# Check if bot is running
curl http://localhost:3000/health

# Check logs
pm2 logs unit-talk-bot
# OR
docker-compose logs -f unit-talk-bot
```

### Database Maintenance
```bash
# Run migrations
npm run migrate

# Backup database
npm run backup

# Restore database
npm run restore
```

### Updates
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart (PM2)
pm2 restart unit-talk-bot

# OR restart (Docker)
docker-compose restart unit-talk-bot
```

## 🚨 Troubleshooting

### Common Issues

1. **Bot not starting:**
   - Check environment variables
   - Verify Discord token and permissions
   - Check database connectivity

2. **Commands not working:**
   - Ensure commands are deployed
   - Check bot permissions in Discord
   - Verify role/channel IDs

3. **Database errors:**
   - Check Supabase credentials
   - Verify database schema
   - Check network connectivity

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

### Logs Location
- PM2: `~/.pm2/logs/`
- Docker: `docker-compose logs`
- systemd: `journalctl -u unit-talk-bot`

## 🔐 Security Considerations

1. **Environment Variables:**
   - Never commit `.env` files
   - Use secure secret management in production
   - Rotate tokens regularly

2. **Database:**
   - Use connection pooling
   - Enable SSL connections
   - Regular backups

3. **Discord:**
   - Minimal required permissions
   - Regular permission audits
   - Monitor for suspicious activity

## 📈 Scaling

### Horizontal Scaling
- Use Redis for session storage
- Implement message queues
- Load balance multiple instances

### Vertical Scaling
- Monitor memory usage
- Optimize database queries
- Use caching strategies

---

For more detailed information, see the main [README.md](README.md) file.