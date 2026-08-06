const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, "out");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, data, contentType) {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(data);
}

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";

    let filePath = path.join(ROOT, urlPath);

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      fs.readFile(filePath, (err, data) => {
        if (!err) {
          const ext = path.extname(filePath);
          send(res, 200, data, MIME[ext] || "application/octet-stream");
          return;
        }

        // Next.js static export writes some routes as "route.html" rather
        // than "route/index.html" — try that before falling back to 404.
        fs.readFile(`${filePath}.html`, (err2, data2) => {
          if (!err2) {
            send(res, 200, data2, "text/html; charset=utf-8");
            return;
          }
          fs.readFile(path.join(ROOT, "404.html"), (err3, data3) => {
            send(res, 404, err3 ? "Not found" : data3, "text/html; charset=utf-8");
          });
        });
      });
    });
  })
  .listen(PORT, () => console.log(`Streakhire static server listening on ${PORT}`));
