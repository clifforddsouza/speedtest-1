# SpeedTest Application Port Mismatch Resolution Guide

I've identified the root of your 502 Bad Gateway issues. There's a mismatch between ports - your Nginx configuration is correctly set to use port 3000, but according to the error logs, the application is trying to connect to port 5000.

## Understanding the Problem

From the Nginx error logs:
```
upstream prematurely closed connection while reading response header from upstream, client: 192.168.5.95, server: 192.168.8.92, request: "POST /api/login HTTP/1.1", upstream: "http://127.0.0.1:5000/api/login"
```

This shows Nginx is forwarding requests to port 5000, but your configuration shows:
```nginx
location / {
    proxy_pass http://localhost:3000;
    ...
}
```

## Fix Options

I've created three different fix scripts, each addressing a different aspect of the problem:

### 1. Fix Port Mismatch (`fix_port_mismatch.sh`)

**This is the most comprehensive solution and should be tried first.** This script:
- Detects which port your application is actually running on
- Updates Nginx configuration to use the correct port
- Updates PM2 ecosystem file and .env file if needed
- Restarts services to apply changes

Run it as:
```bash
chmod +x fix_port_mismatch.sh
sudo ./fix_port_mismatch.sh
```

### 2. Fix Nginx Configuration (`fix_nginx_config.sh`)

If you already know your application is running on port 3000 and just need to fix Nginx:
```bash
chmod +x fix_nginx_config.sh
sudo ./fix_nginx_config.sh
```

### 3. Fix Database Connection (`neon_db_fix.sh`)

This fixes the database connection issues by replacing the WebSocket-based connection with direct TCP:
```bash
chmod +x neon_db_fix.sh
./neon_db_fix.sh
```

## Manual Fix Options

If the scripts don't work, you can try these manual steps:

1. Find what port your application is actually running on:
   ```bash
   pm2 describe speedtest
   # Look for the PORT environment variable
   ```

2. Update your Nginx configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/speedtest
   # Change all instances of proxy_pass to use the correct port
   # Save and exit
   ```

3. Test and reload Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. Restart your application:
   ```bash
   pm2 restart speedtest
   ```

## Troubleshooting

If you're still having issues after applying these fixes:

1. Check application logs:
   ```bash
   pm2 logs speedtest
   ```

2. Check Nginx error logs:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

3. Verify the actual port your application is using:
   ```bash
   netstat -tlnp | grep node
   # or
   ss -tlnp | grep node
   ```

4. Ensure your database connection is working by running the test script:
   ```bash
   node /opt/speedtest/test_db_connection.js
   ```

## Contact for Further Help

If none of these solutions work, please provide the following information for further debugging:
- Output of `pm2 describe speedtest`
- Contents of your Nginx configuration file
- The port shown in the error logs
- Any updates to the application that happened before this issue started