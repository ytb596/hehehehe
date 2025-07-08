const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/', (req, res) => {
    const filePath = path.join(__dirname, '..', 'videos.txt');

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Không đọc được videos.txt' });
        }

        const links = data.split('\n').map(l => l.trim()).filter(Boolean);
        if (links.length === 0) {
            return res.status(404).json({ error: 'Danh sách video rỗng' });
        }

        const randomLink = links[Math.floor(Math.random() * links.length)];
        res.json({ message: 'Random video gái', video: randomLink });
    });
});

module.exports = router;
