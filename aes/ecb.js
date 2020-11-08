const { AES } = require("./aes");
const { coerceArray, createArray, copyArray, get16BytesArray, trimDecrypted } = require("./utils");

class ECB {
  constructor(key) {
    this.description = 'Electronic Code Block';
    this.name = 'ecb';
    this._aes = new AES(key);
  }

  encrypt(utf8text) {
    let plaintext = get16BytesArray(utf8text);
    plaintext = coerceArray(plaintext);

    if ((plaintext.length % 16) !== 0) {
      throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
    }

    var cipherText = createArray(plaintext.length);
    var block = createArray(16);

    for (var i = 0; i < plaintext.length; i += 16) {
      copyArray(plaintext, block, 0, i, i + 16);
      block = this._aes.encrypt(block);
      copyArray(block, cipherText, i);
    }

    return cipherText;
  }

  decrypt(cipherText) {
    cipherText = coerceArray(cipherText);

    if ((cipherText.length % 16) !== 0) {
      throw new Error('invalid cipherText size (must be multiple of 16 bytes)');
    }

    var plaintext = createArray(cipherText.length);
    var block = createArray(16);

    for (var i = 0; i < cipherText.length; i += 16) {
      copyArray(cipherText, block, 0, i, i + 16);
      block = this._aes.decrypt(block);
      copyArray(block, plaintext, i);
    }

    return trimDecrypted(plaintext);
  }
}

module.exports = { ECB };