const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keyDir = path.join(__dirname, '../keys');
const privateKeyPath = path.join(keyDir, 'private.pem');
const publicKeyPath = path.join(keyDir, 'public.pem');

const generateKeyPair = () => {
  try {
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }
    
    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      return;
    }
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    
    console.log('RSA密钥对生成成功');
  } catch (error) {
    console.error('RSA密钥对生成失败:', error.message);
    throw new Error('无法生成RSA密钥对，请检查keys目录权限');
  }
};

generateKeyPair();

let privateKey;
let publicKey;

try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  publicKey = fs.readFileSync(publicKeyPath, 'utf8');
  console.log('RSA密钥加载成功');
} catch (error) {
  console.error('RSA密钥加载失败:', error.message);
  throw new Error('无法加载RSA密钥，请检查密钥文件是否存在');
}

const decryptPassword = (encryptedPassword) => {
  try {
    const buffer = Buffer.from(encryptedPassword, 'base64');
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('密码解密失败:', error.message);
    throw new Error('密码解密失败');
  }
};

const getPublicKey = () => {
  return publicKey;
};

module.exports = { decryptPassword, getPublicKey };