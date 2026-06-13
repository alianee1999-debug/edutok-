<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#09090b" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>EduTok - التعلم بطريقة ممتعة</title>
    <link rel="icon" type="image/png" href="https://cdn-icons-png.flaticon.com/512/8841/8841503.png" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        background: #09090b;
        font-family: system-ui, -apple-system, sans-serif;
        overscroll-behavior: none;
        overflow: hidden;
        height: 100%;
        touch-action: pan-x pan-y;
      }
      #root {
        display: flex;
        justify-content: center;
        height: 100vh;
        overflow-y: auto;
        overscroll-behavior: none;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
