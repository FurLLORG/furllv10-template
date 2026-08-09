<!DOCTYPE html>
<html lang="zh-CN" theme="{$clientarea_theme_color}" id="addons_js" addons_js='{:json_encode($addons)}'>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FurLL 客户中心</title>
    <script>
        window.__LANG_CONFIG__ = {
            lang_home: "{$lang_home}",
            lang_home_follow_browser: {$lang_home_follow_browser},
            lang_home_open: {$lang_home_open}
        };
        window.__CLIENT_CONFIG__ = {
            system_version: "{$system_version}",
            theme_color: "{$clientarea_theme_color}",
            addons: {:json_encode($addons)}
        };
    </script>
    <link rel="stylesheet" href="/web/FurLLV10/assets/index.css">
</head>
<body>
