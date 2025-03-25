<?php
// handle preflight request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header('HTTP/1.1 204 No Content');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: *');
    header('Access-Control-Allow-Headers: *');
    exit(0);
}
/*
$proxyPassword = '';
$headersPass = getallheaders();
if (!isset($headersPass['proxy-password']) || $headersPass['proxy-password'] !== $proxyPassword) {
    header('HTTP/1.0 403 Forbidden');
    echo "Invalid or missing proxy-password\n";
    exit(1);
}*/

if (!isset($_GET['url']) || $_GET['url'] == '') {
    header('HTTP/1.0 400 Bad Request');
    echo "url parameter missing\n";
    exit(1);
}
if (substr($_GET['url'], 0, 7) != 'http://' && substr($_GET['url'], 0, 8) != 'https://') {
    header('HTTP/1.0 400 Bad Request');
    echo "Only http and https URLs supported\n";
    exit(1);
}

$url = $_GET['url'];

// use this request's HTTP headers, replace "Host" with host from $url,
// drop "Origin" and "Access-Control-*" headers
$headers = [];
foreach (apache_request_headers() as $name => $value) {
    $key = strtolower($name);
    if ($key == 'host' || $key == 'origin' || $key == 'access-control-request-method' ||
            $key == 'access-control-request-headers') {
        continue;
    }
    $headers[] = $name . ': ' . $value;
}
$headers[] = 'host: ' . parse_url($url, PHP_URL_HOST);

// apply rather forgiving error handling for our nested HTTP request
$context = stream_context_create([
    'http' => [
        'header' => $headers,
        'ignore_errors' => true
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true
    ]
]);

// execute nested HTTP request
$fp = fopen($url, 'rb', false, $context);
if (!$fp) {
    header('HTTP/1.0 400 Bad Request');
    echo "Error fetching URL\n";
    exit(1);
}

// send resonse headers from netsted HTTP response
if (is_array($http_response_header)) {
    foreach ($http_response_header as $header) {
        header($header);
    }
}

// inject wildcard CORS response headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: *');
header('Access-Control-Allow-Headers: *');
ob_flush();
flush();

// stream nested response body in chunks
while (!feof($fp)) {
    echo fread($fp, 8192);
    ob_flush();
    flush();
}
fclose($fp);
?>
