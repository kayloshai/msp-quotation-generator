# Deployment Guide: Using Afrihost Domain with DigitalOcean

## Overview
This guide explains how to deploy your quotation generator to DigitalOcean and connect your existing Afrihost domain.

---

## Option 1: Update Nameservers (Recommended)

### Step 1: Deploy to DigitalOcean
1. Create a DigitalOcean account at [digitalocean.com](https://www.digitalocean.com)
2. Deploy your React app using:
   - **App Platform** (easier, managed)
   - **Droplet** (more control, requires manual setup)
3. DigitalOcean will provide you with a default domain (e.g., `myapp-123.ondigitalocean.app`)

### Step 2: Get DigitalOcean Nameservers
1. In DigitalOcean dashboard → **Networking** → **Domains**
2. Add your domain (e.g., `yoursite.co.za`)
3. DigitalOcean will show you 3 nameservers:
   - `ns1.digitalocean.com`
   - `ns2.digitalocean.com`
   - `ns3.digitalocean.com`

### Step 3: Update Afrihost Settings
1. Log in to **Afrihost Control Panel**
2. Go to **Domains** → Select your domain
3. Find **Nameservers** section
4. Replace Afrihost nameservers with DigitalOcean's:
   - `ns1.digitalocean.com`
   - `ns2.digitalocean.com`
   - `ns3.digitalocean.com`
5. Save changes
   - **Note:** DNS propagation takes 24-48 hours

### Step 4: Configure DigitalOcean DNS
1. Back in DigitalOcean → **Networking** → **Domains**
2. Create DNS records:
   - **A record**: `@` → points to your DigitalOcean app IP
   - **CNAME record**: `www` → points to your app domain
3. Add SSL certificate (free via Let's Encrypt)

---

## Option 2: Use Afrihost DNS + Point to DigitalOcean

If you want to keep Afrihost as DNS manager:

### Step 1: Get Your DigitalOcean App IP
- Deploy your app on DigitalOcean
- Note the IP address of your app/droplet

### Step 2: Add DNS Records at Afrihost
1. Log in to **Afrihost Control Panel**
2. Go to **Domains** → Select your domain → **DNS Settings**
3. Add **A record**:
   - **Name:** `@` (for root domain)
   - **Points to:** Your DigitalOcean app IP address
   - **TTL:** 3600 (or default)

4. Add **CNAME record**:
   - **Name:** `www`
   - **Points to:** Your DigitalOcean app URL
   - **TTL:** 3600 (or default)

5. Save and wait for propagation (24-48 hours)

---

## Security Measures When Hosting

### 1. HTTPS/SSL Certificate
- Use HTTPS (not HTTP)
- DigitalOcean provides free SSL via Let's Encrypt
- Enable automatic certificate renewal

### 2. Authentication & Access Control
- Implement user login before accessing the app
- Use backend authentication service
- Never store plain passwords
- Use password hashing (bcrypt, argon2)

### 3. Environment Variables
Never commit sensitive data to git:
```
DATABASE_URL=your_database_url
API_KEY=your_api_key
JWT_SECRET=your_secret
```

Store in `.env` file (add to `.gitignore`)

### 4. Backend API
- Move data from localStorage to secure database
- Validate all inputs server-side
- Implement rate limiting
- Use CORS properly

### 5. Security Headers
Add HTTP headers to your server:
```
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
```

### 6. Input Validation
- Validate all user inputs (frontend & backend)
- Sanitize data to prevent XSS attacks
- Escape special characters

### 7. Regular Backups
- Set up automatic daily backups
- Test restore procedures regularly

### 8. Keep Dependencies Updated
- Regularly update npm packages
- Monitor for security vulnerabilities
- Run: `npm audit` and `npm audit fix`

---

## Deployment Checklist

- ✅ Domain registered at Afrihost
- ✅ App deployed on DigitalOcean
- ✅ Nameservers updated (or DNS records configured)
- ✅ SSL certificate enabled
- ✅ Wait 24-48 hours for DNS propagation
- ✅ Test: visit `yoursite.co.za` in browser
- ✅ Implement authentication
- ✅ Set up environment variables
- ✅ Enable HTTPS redirect
- ✅ Configure firewall rules
- ✅ Set up monitoring & alerts
- ✅ Enable backups

---

## Useful Resources

### DigitalOcean
- [App Platform Documentation](https://docs.digitalocean.com/products/app-platform/)
- [Connecting Custom Domains](https://docs.digitalocean.com/products/app-platform/how-to/manage-domains/)
- [Droplet Getting Started](https://docs.digitalocean.com/products/droplets/getting-started/)

### Afrihost
- [Afrihost Control Panel](https://www.afrihost.com/)
- [Afrihost DNS Management](https://www.afrihost.com/help/dns)

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Let's Encrypt (Free SSL)](https://letsencrypt.org/)

---

## Troubleshooting

### Domain not resolving after 48 hours
1. Check DNS propagation: [whatsmydns.net](https://www.whatsmydns.net/)
2. Verify nameservers are correct in Afrihost
3. Clear browser cache (Ctrl+Shift+Delete)
4. Flush DNS cache:
   - **Windows:** `ipconfig /flushdns`
   - **Mac:** `sudo dscacheutil -flushcache`
   - **Linux:** `sudo systemctl restart systemd-resolved`

### SSL Certificate Not Working
1. Ensure HTTPS is enforced in DigitalOcean
2. Wait 30 minutes for Let's Encrypt to issue certificate
3. Check certificate status in DigitalOcean dashboard

### App Not Loading
1. Check DigitalOcean app logs
2. Verify firewall rules allow port 80 & 443
3. Confirm environment variables are set correctly

---

## Next Steps

1. **Deploy to DigitalOcean** - Use App Platform for easiest setup
2. **Connect Afrihost domain** - Update nameservers or DNS records
3. **Implement authentication** - Add login system for security
4. **Set up database** - Move from localStorage to persistent storage
5. **Enable monitoring** - Set up alerts for downtime/errors
6. **Regular backups** - Automate daily backups
7. **Test thoroughly** - Verify all features work in production

---

**Last Updated:** 2026-07-29
