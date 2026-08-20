const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileHash = req.query.fileHash;
    const chunkDir = path.join(uploadDir, fileHash);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    cb(null, req.query.chunkNumber);
  }
});

const upload = multer({ storage });

router.get('/check', authenticate, (req, res) => {
  const { fileHash, filename } = req.query;
  
  const fullPath = path.join(uploadDir, `${fileHash}_${filename}`);
  const chunkDir = path.join(uploadDir, fileHash);
  
  if (fs.existsSync(fullPath)) {
    return res.json({ 
      code: 200, 
      data: { 
        isCompleted: true, 
        filePath: `/uploads/${path.basename(fullPath)}`,
        message: '文件已存在，秒传成功'
      } 
    });
  }
  
  const uploadedChunks = [];
  if (fs.existsSync(chunkDir)) {
    const files = fs.readdirSync(chunkDir);
    files.forEach(file => {
      uploadedChunks.push(parseInt(file));
    });
  }
  
  res.json({ 
    code: 200, 
    data: { 
      isCompleted: false, 
      uploadedChunks 
    } 
  });
});

router.post('/chunk', authenticate, upload.single('file'), (req, res) => {
  const { chunkNumber, totalChunks, fileHash } = req.query;
  
  res.json({ 
    code: 200, 
    message: '分片上传成功', 
    data: { 
      chunkNumber: parseInt(chunkNumber), 
      totalChunks: parseInt(totalChunks),
      fileHash
    } 
  });
});

router.post('/merge', authenticate, (req, res) => {
  const { fileHash, filename, totalChunks } = req.body;
  
  const chunkDir = path.join(uploadDir, fileHash);
  
  if (!fs.existsSync(chunkDir)) {
    return res.json({ code: 400, message: '分片目录不存在' });
  }
  
  const chunks = [];
  for (let i = 1; i <= totalChunks; i++) {
    const chunkFilePath = path.join(chunkDir, i.toString());
    if (!fs.existsSync(chunkFilePath)) {
      return res.json({ code: 400, message: `分片 ${i} 缺失` });
    }
    chunks.push(fs.readFileSync(chunkFilePath));
  }
  
  const fullBuffer = Buffer.concat(chunks);
  const finalFilename = `${fileHash}_${filename}`;
  const finalPath = path.join(uploadDir, finalFilename);
  fs.writeFileSync(finalPath, fullBuffer);
  
  fs.rmSync(chunkDir, { recursive: true });
  
  res.json({ 
    code: 200, 
    message: '合并成功', 
    data: { 
      filename: finalFilename, 
      path: `/uploads/${finalFilename}` 
    } 
  });
});

module.exports = router;