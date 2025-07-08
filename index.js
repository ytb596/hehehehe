const express = require('express');
const fs = require('fs');
const path = require('path');
const decode = require('decode-uri-component');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// === Cấu hình ===
const ADMIN_PASSWORD = '37'; // ← đổi thành mật khẩu admin của bạn
let maintenanceMode = false;
let maintenanceNote = 'Hệ thống đang bảo trì. Vui lòng quay lại sau.';

// Middleware parse form POST
app.use(bodyParser.urlencoded({ extended: false }));

// === Giao diện bảo trì (nếu bật) ===
app.use((req, res, next) => {
    if (maintenanceMode && req.path !== '/tien-ich/baotri') {
        return res.send(`
            <!DOCTYPE html>
            <html lang="vi"><head><meta charset="UTF-8"><title>Bảo trì</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 100px; background: #f7f7f7; }
                h1 { font-size: 36px; color: red; }
                p { font-size: 18px; }
            </style>
            </head><body>
                <h1>🚧 BẢO TRÌ 🚧</h1>
                <p>${maintenanceNote}</p>
            </body></html>
        `);
    }
    next();
});

// === Giao diện /tien-ich/baotri ===
app.get('/tien-ich/baotri', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi"><head><meta charset="UTF-8"><title>Admin - Bảo trì</title>
        <style>
            body { font-family: sans-serif; text-align: center; margin-top: 100px; }
            input, button, textarea { font-size: 18px; margin: 10px; padding: 10px; width: 300px; }
        </style>
        </head><body>
            <h2>Đăng nhập Admin</h2>
            <form method="POST" action="/tien-ich/baotri">
                <input type="password" name="password" placeholder="Mật khẩu" required><br>
                <button type="submit">Đăng nhập</button>
            </form>
        </body></html>
    `);
});

app.post('/tien-ich/baotri', (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.send(`
            <h1 style="color: red;">Sai mật khẩu</h1>
            <a href="/tien-ich/baotri">Thử lại</a>
        `);
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="vi"><head><meta charset="UTF-8"><title>Admin Bảo trì</title>
        <style>
            body { font-family: sans-serif; text-align: center; margin-top: 50px; }
            textarea { width: 400px; height: 100px; font-size: 16px; }
            button { font-size: 16px; padding: 10px 20px; margin: 10px; }
        </style>
        </head><body>
            <h1>Bảng điều khiển bảo trì</h1>
            <form method="POST" action="/tien-ich/baotri/set">
                <textarea name="note" placeholder="Ghi chú bảo trì...">${maintenanceNote}</textarea><br>
                <button name="action" value="on">Bật bảo trì</button>
                <button name="action" value="off">Tắt bảo trì</button>
                <button name="action" value="pause">Tạm ngừng</button>
            </form>
        </body></html>
    `);
});

app.post('/tien-ich/baotri/set', (req, res) => {
    const { action, note } = req.body;

    maintenanceNote = note || maintenanceNote;

    if (action === 'on') {
        maintenanceMode = true;
    } else if (action === 'off') {
        maintenanceMode = false;
    }

    res.redirect('/tien-ich/baotri');
});

// === Phục vụ HTML tĩnh từ thư mục "vk" ===
app.use('/vk', express.static(path.join(__dirname, 'vk')));

// === Theo dõi thay đổi file HTML ===
const watchPath = path.join(__dirname, 'vk');
let lastModified = Date.now();

fs.watch(watchPath, { recursive: false }, (eventType, filename) => {
    if (filename && path.extname(filename) === '.html') {
        console.log(`[Theo dõi] ${eventType} - ${filename}`);
        lastModified = Date.now();
    }
});

// === API kiểm tra thay đổi file HTML ===
app.get('/last-change', (req, res) => {
    res.json({ lastModified });
});

// === Trang chủ: hiển thị danh sách file .html ===
app.get('/', (req, res) => {
    const folderPath = path.join(__dirname, 'vk');

    fs.readdir(folderPath, (err, files) => {
        if (err) return res.status(500).send('Lỗi server');
        const htmlFiles = files.filter(file => path.extname(file) === '.html');

        const buttonsHtml = htmlFiles.map(file => {
            return `<button onclick="window.location.href='/vk/${encodeURIComponent(file)}'">${file}</button>`;
        }).join('<br><br>');

        res.send(`
            <!DOCTYPE html>
            <html lang="vi"><head><meta charset="UTF-8"><title>Danh sách</title>
            <style>
                button { margin: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
            </style></head><body>
                <h1>Nguyen.net</h1>
                <div id="content">
                    ${buttonsHtml}
                </div>
                <script>
                    let last = ${lastModified};
                    async function checkReload() {
                        try {
                            const res = await fetch('/last-change');
                            const data = await res.json();
                            if (data.lastModified > last) {
                                location.reload();
                            }
                        } catch (e) {
                            console.error("Lỗi kiểm tra reload:", e);
                        }
                    }
                    setInterval(checkReload, 3000);
                </script>
            </body></html>
        `);
    });
});

// === API decode URI động ===
app.get('/api', (req, res) => {
    const rawQuery = req.url.split('?')[1] || '';
    const pairs = rawQuery.split('&').map(q => q.split('='));
    const parsed = {};

    for (let [key, value] of pairs) {
        try {
            key = decode(key || '');
            value = decode(value || '');
            parsed[key] = value;
        } catch (err) {
            parsed[key] = 'INVALID_ENCODING';
        }
    }

    res.json({ message: 'API động tự decode', rawQuery, parsedQuery: parsed });
});

// === Load các route phụ trong /api/ nếu có ===
const apiDir = path.join(__dirname, 'api');
if (fs.existsSync(apiDir)) {
    fs.readdirSync(apiDir).forEach(file => {
        if (file.endsWith('.js')) {
            const route = require(path.join(apiDir, file));
            const routePath = `/api/${file.replace('.js', '')}`;
            app.use(routePath, route);
        }
    });
}

app.listen(PORT, () => {
    console.log(`>>> Server chạy tại: http://localhost:${PORT}`);
});
