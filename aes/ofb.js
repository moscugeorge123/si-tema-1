const { AES } = require("./aes");
const { coerceArray, createArray } = require("./utils");

class OFB {
  constructor(key, iv) {
    this.description = "Output Feedback";
    this.name = "ofb";
    
    if (!iv) {
      iv = createArray(16);
    } else if (iv.length != 16) {
      throw new Error('invalid initialization vector size (must be 16 bytes)');
    }
    
    this._iv = iv;
    this._aes = new AES(key);
  }

  encrypt(plaintext) {
    let encrypted = coerceArray(plaintext, true);

    this._lastPreCipher = coerceArray(this._iv, true);
    this._lastPreCipherIndex = 16;

    for (var i = 0; i < encrypted.length; i++) {
      if (this._lastPreCipherIndex === 16) {
        this._lastPreCipher = this._aes.encrypt(this._lastPreCipher);
        this._lastPreCipherIndex = 0;
      }
      encrypted[i] ^= this._lastPreCipher[this._lastPreCipherIndex++];
    }

    return encrypted;
  }

  decrypt(cypherText) {
    return this.encrypt(cypherText);
  }
}

module.exports = { OFB };