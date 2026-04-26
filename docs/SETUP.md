# Tiptopf-AI Setup Guide

Local-first, AI-powered recipe library designed for self-hosting.

## Alternative: Docker (Simplest)

If you just want to run the app in a Docker container on any machine (including a Raspberry Pi), see `docs/local-pi-deployment.md` (Option B). Docker handles all dependencies and is the recommended approach for most users.

The rest of this guide covers **direct Node.js installation** on a Raspberry Pi.

---

## Hardware Requirements

- **Raspberry Pi 4** (4GB RAM recommended) or Raspberry Pi 5
- **microSD card** (32GB minimum, 64GB+ recommended)
- **Power supply** (official Pi 4 power adapter, 15W USB-C)
- **Network connection** via Ethernet or WiFi

---

## 1. Install Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Select your SD card
3. Choose **Raspberry Pi OS (64-bit)** (or Raspberry Pi OS Lite if you're comfortable without desktop)
4. Click the gear icon for advanced options:
   - Set hostname: `tiptopf`
   - Enable SSH with password authentication
   - Set a strong password for the `pi` user
   - Configure WiFi (if not using Ethernet)
5. Write the image to your SD card
6. Insert SD card and boot up your Pi

---

## 2. Initial Pi Setup

Connect to your Pi via SSH:

```bash
ssh pi@tiptopf.local
```

Or if that doesn't work, find the IP address and connect:

```bash
ssh pi@<your-pi-ip>
```

Run the initial setup:

```bash
sudo raspi-config
```

Recommended settings:
- **System Options > Wireless LAN** — configure if needed
- **Interface Options > SSH** — ensure enabled
- **Advanced > Memory Split** — set to 256MB minimum

Update the system:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Install Node.js

The app requires Node.js 20+. Install it via NodeSource:

```bash
# Install NodeSource repository for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

---

## 4. Install Tailscale (Recommended)

Tailscale provides secure remote access to your Pi from anywhere without configuring port forwarding.

### Install Tailscale:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### Authenticate:

```bash
sudo tailscale up
```

This will print a URL. Open it in your browser to authenticate your device.

### Verify connection:

```bash
tailscale status
```

Note your Tailscale IP address (e.g., `100.x.x.x`) — you'll use this to access the app.

For more details, see the [Tailscale Raspberry Pi guide](https://tailscale.com/blog/raspberry-pi/).

---

## 5. Clone and Configure the Application

### Clone the repository:

```bash
cd /home/pi
git clone https://github.com/your-username/Tiptopf-AI.git
cd Tiptopf-AI
```

### Create the data directory:

```bash
sudo mkdir -p /home/pi/tiptopf-data
sudo chown pi:pi /home/pi/tiptopf-data
```

### Create environment file:

```bash
cp .env.example .env.local
```

### Edit `.env.local`:

```bash
nano .env.local
```

Set the following:

```env
# Required: directory for recipe data and images
DATA_DIR=/home/pi/tiptopf-data
```

API keys and model/base URL settings are configured in the app at `/profile`.

Save with `Ctrl+O`, then `Ctrl+X`.

---

## 6. Install Dependencies and Build

```bash
npm install
npm run build
```

---

## 7. Run the Application

### For development (with auto-reload):

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

### For production:

```bash
npm run start -- --hostname 0.0.0.0 --port 3000
```

The `0.0.0.0` binding is required to allow connections from other devices on your network.

---

## 8. Access the Application

### On the same network (local):

Open your browser and go to:

```
http://tiptopf.local:3000
```

Or using the Pi's IP address:

```
http://<your-pi-ip>:3000
```

### Via Tailscale (from anywhere):

```
http://<your-tailscale-ip>:3000
```

---

## 9. Using the Application

### First Launch

The app opens directly to `/library`. Since there's no authentication, you're ready to start adding recipes immediately.

### Adding a Recipe

1. Click the **"+"** button in the library view
2. Choose one:
   - **URL** — paste a recipe website link and AI will extract the recipe
   - **Bild hochladen** — upload a photo of a recipe (e.g., from a cookbook)

3. Wait for AI extraction to complete
4. Optionally replace the image
5. Click **Speichern** to add to your library

### Managing Recipes

- **Favoriten** — click the heart icon on any recipe card
- **Filtern** — use the filter bar to show only favorites or by category
- **Sortieren** — change sort order via the dropdown (Neueste, Älteste, Zeit, Bewertung)
- **Rezept ansehen** — click any card to see full details

### Profile Settings

Click the profile icon to:
- Configure OpenCode, Gemini, and Pexels API/model settings
- Export/import your recipe collection

---

## 10. Data Backup

Your recipes and images are stored in `DATA_DIR` (default: `/home/pi/tiptopf-data`).

### Backup:

```bash
# Navigate to your home directory
cd /home/pi

# Create a timestamped backup
sudo tar -czf tiptopf-backup-$(date +%Y%m%d).tar.gz tiptopf-data
```

### Restore:

```bash
cd /home/pi
sudo tar -xzf tiptopf-backup-YYYYMMDD.tar.gz
```

### Automated Backups (optional)

Create a cron job for daily backups:

```bash
crontab -e
```

Add this line:

```
0 2 * * * tar -czf /home/pi/tiptopf-backup-$(date +\%Y\%m\%d).tar.gz -C /home/pi tiptopf-data
```

---

## 11. Running as a Background Service (Optional)

Keep the app running after you close your SSH session using systemd:

### Create the service file:

```bash
sudo nano /etc/systemd/system/tiptopf.service
```

Add:

```ini
[Unit]
Description=Tiptopf-AI Recipe Library
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Tiptopf-AI
ExecStart=/usr/bin/npm run start -- --hostname 0.0.0.0 --port 3000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tiptopf
sudo systemctl start tiptopf
```

### Service commands:

```bash
# Check status
sudo systemctl status tiptopf

# View logs
sudo journalctl -u tiptopf -f

# Restart
sudo systemctl restart tiptopf
```

---

## 12. Updating the Application

```bash
cd /home/pi/Tiptopf-AI
git pull
npm install
npm run build
sudo systemctl restart tiptopf
```

---

## 13. Troubleshooting

### App won't start

```bash
# Check if port 3000 is already in use
sudo lsof -i :3000

# Check Node is installed
node --version

# Check for build errors
npm run build
```

### Can't access from other devices

- Ensure the app is bound to `0.0.0.0` (not `127.0.0.1`)
- Check your firewall: `sudo ufw status`
- If using Tailscale, verify both devices are connected: `tailscale status`

### Data not persisting

- Verify `DATA_DIR` is set correctly in `.env.local`
- Check the directory is writable: `ls -la /home/pi/tiptopf-data`

### Images not loading

- Check files exist: `ls /home/pi/tiptopf-data/recipe-images/`
- Verify the images API route works: `curl http://localhost:3000/api/images/test.jpg`

### Tailscale connection issues

```bash
# Re-authenticate Tailscale
sudo tailscale up

# Check status
tailscale status
```

---

## Security Notes

- **No built-in authentication** — access is controlled via Tailscale network identity
- **API keys are stored in `DATA_DIR/tiptopf.json`** (currently unencrypted)
- **Use Tailscale ACLs** to restrict who can access your Pi
- **Regular backups** — your recipe data is only as safe as your last backup

---

## Getting Help

- Open an issue at: https://github.com/your-username/Tiptopf-AI/issues
- Check the project docs in `docs/`
