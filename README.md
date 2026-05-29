# Digifyce Internal Platform — PHP Edition
Deployment guide for cPanel shared hosting (PHP 8+)

---

## Step 1 — Create subdomain in cPanel
1. Log into cPanel → **Subdomains**
2. Create: `platform.yourdomain.com`
3. Set document root to: `public_html/platform` (or any folder)
4. Note the folder path — you'll upload files here

---

## Step 2 — Create MySQL database
1. cPanel → **MySQL Databases**
2. Create a new database: e.g. `youruser_digifyce`
3. Create a new user: e.g. `youruser_dfapp` with a strong password
4. Add user to database with **All Privileges**
5. Note: DB Name, DB User, DB Password, DB Host (usually `localhost`)

---

## Step 3 — Import database schema
1. cPanel → **phpMyAdmin**
2. Click your new database on the left
3. Click the **SQL** tab
4. Open `install.sql` from this zip, copy all contents, paste and click **Go**
5. You should see all 8 tables created

**Default login after import:**
- Email: `admin@digifyce.in`
- Password: `Admin@1234`
- **Change this immediately after first login in Admin → User Management**

---

## Step 4 — Configure database connection
1. Open `api/config.php`
2. Update these 4 lines:
```php
define('DB_HOST', 'localhost');       // usually localhost
define('DB_NAME', 'youruser_digifyce');
define('DB_USER', 'youruser_dfapp');
define('DB_PASS', 'your_password');
```
3. Optionally add API keys directly (or set them later in Admin → Settings):
```php
define('ANTHROPIC_API_KEY', 'sk-ant-...');
define('OPENAI_API_KEY',    'sk-...');
```

---

## Step 5 — Upload files
Upload ALL files from this zip into your subdomain folder:
```
platform/               ← your subdomain root
├── .htaccess
├── index.html
├── app.html
├── assets/
│   ├── app.js
│   └── style.css
└── api/
    ├── config.php
    ├── auth.php
    ├── brands.php
    ├── admin.php
    ├── ai.php
    ├── pricing.php
    ├── strategy.php
    └── budget.php
```

**Via cPanel File Manager:**
- Upload the zip → Extract → files appear in place

**Via FTP (FileZilla etc):**
- Host: your domain, Port: 21
- Upload the extracted folder contents

---

## Step 6 — Test
1. Visit `https://platform.yourdomain.com`
2. Login with `admin@digifyce.in` / `Admin@1234`
3. Go to Admin → Settings → add your Claude/ChatGPT API key
4. Create your first brand

---

## Troubleshooting

**Blank page / 500 error:**
- Check `api/config.php` DB credentials
- Make sure `.htaccess` uploaded (it's a hidden file — enable "Show Hidden Files" in File Manager)
- PHP error log: cPanel → Error Log

**Login fails:**
- Check DB import ran successfully in phpMyAdmin
- Try re-importing `install.sql`

**AI not working:**
- Go to Admin → Settings → add API key → click Test button
- Make sure PHP `allow_url_fopen` is On (it is by default on most hosts)

**mod_rewrite not working:**
- Contact your host to confirm `mod_rewrite` is enabled
- Some hosts need `AllowOverride All` set — ask support

---

## Adding team members
1. Admin → User Management → Add User
2. Set role: User / Manager / Superadmin
3. Assign pages and brands they can access
