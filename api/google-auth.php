<?php
require_once __DIR__ . '/config.php';

// Auth checks
$user = requireAuth();
if ($user['role'] !== 'superadmin') {
    die("Access denied: Superadmin privileges required.");
}

$action = $_GET['action'] ?? '';

// Step 1: Redirect to Google
if ($action === 'authorize') {
    $clientId = getSetting('google_client_id');
    if (empty($clientId)) {
        die("Error: Google Client ID is not configured. Please save it in System Settings first.");
    }
    
    $redirectUri = (empty($_SERVER['HTTPS']) ? 'http://' : 'https://') . $_SERVER['HTTP_HOST'] . '/api/google-auth.php';
    
    // Scopes for GA4, Google Ads, Search Console
    $scopes = [
        'https://www.googleapis.com/auth/adwords',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly'
    ];
    
    $params = [
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => implode(' ', $scopes),
        'access_type' => 'offline',
        'prompt' => 'consent'
    ];
    
    $authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query($params);
    header("Location: " . $authUrl);
    exit;
}

// Step 2: OAuth 2.0 Callback Handling
$code = $_GET['code'] ?? '';
if ($code) {
    $clientId = getSetting('google_client_id');
    $clientSecret = getSetting('google_client_secret');
    $redirectUri = (empty($_SERVER['HTTPS']) ? 'http://' : 'https://') . $_SERVER['HTTP_HOST'] . '/api/google-auth.php';
    
    $ch = curl_init("https://oauth2.googleapis.com/token");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'code' => $code,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri' => $redirectUri,
        'grant_type' => 'authorization_code'
    ]));
    
    $resp = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $data = json_decode($resp, true);
    
    if ($status !== 200 || empty($data['refresh_token'])) {
        echo "<h2>OAuth Authorization Failed</h2>";
        echo "<p>Google API responded with code: <strong>" . $status . "</strong></p>";
        echo "<pre>" . print_r($data, true) . "</pre>";
        echo "<p><a href='/app.html#admin'>Back to Admin Console</a></p>";
        exit;
    }
    
    // Save refresh_token
    dbRun("UPDATE settings SET value=? WHERE `key`='google_refresh_token'", [$data['refresh_token']]);
    
    // Render success message
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Authorization Successful</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafbfc; color: #1e293b; }
            .card { background: #fff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 420px; border: 1px solid #e2e8f0; }
            .icon { font-size: 48px; margin-bottom: 20px; }
            h2 { font-size: 22px; font-weight: 800; color: #10B981; margin: 0 0 10px 0; }
            p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 24px 0; }
            .btn { background: #2B4EFF; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-block; transition: background 0.2s; }
            .btn:hover { background: #1A3CD6; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">✅</div>
            <h2>Google Access Authorized</h2>
            <p>The persistent refresh token was obtained and saved successfully. You can now configure brand connections and sync performance metrics.</p>
            <a href="/app.html#admin" class="btn">Return to Dashboard</a>
        </div>
    </body>
    </html>
    <?php
    exit;
}

echo "Invalid authorization request. Please trigger it from the Admin Console.";
