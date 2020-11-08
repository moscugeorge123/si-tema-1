const webSocketServer = require('websocket').server;
const http = require('http');
const configs = require('./config');
const { A, B, OFB: o, ECB: e, shared } = configs;
const { OFB, ECB, hex, utf8 } = require('./aes');
const fs = require('fs');
const path = require('path');

class Server {
  constructor(type = 'KM') {
    this._type = type;
    this._config = configs[type];
    this.mod = {};
    this.fileChunks = {};
  }

  setServer = () => new Promise((resolve, reject) => {
    const server = http.createServer(() => {});
    server.listen(this._config.port, () => {
      this.socket = new webSocketServer({ httpServer: server });
      this._handleRequests();

      resolve();
      console.log(`Server opened on port: ${this._config.port}`);
    });

    server.on('error', error => {
      reject(error);
    });
  });

  _handleRequests() {
    this.socket.on('request', request => {
      if (!this.AConnection && request.origin === `endpoint-${A.port}`) {
        console.log('Connected from origin: ', request.origin);
        this.AConnection = request.accept(null, request.origin);
        this._handleIncomingMessages();
        return;
      }
      
      if (!this.BConnection && request.origin === `endpoint-${B.port}`) {
        console.log('Connected from origin: ', request.origin);
        this.BConnection = request.accept(null, request.origin);
        this._handleIncomingMessages();
        return;
      }
      
      if (!this.dataClient && request.origin === 'origin-data-client') {
        console.log('Connected from origin: ', request.origin);
        this.dataClient = request.accept(null, request.origin);
        return;
      }

      request.reject(401, 'Not a requested client');
      console.log('Rejected origin: ', request.origin);
    });
  }

  _handleIncomingMessages() {
    if (this._type === 'KM' && this.AConnection && this.BConnection) {
      this._handleKMIncomeMessages();
      return;
    }

    if (this._type === 'B' && this.AConnection) {
      this._handleBIncomeMessages();
    }
  }

  _handleKMIncomeMessages() {
    const handleInit = (message, from, withEnc = false) => {
      let [, mod] = message.split(' ');
      mod = mod.toLowerCase();

      if (!mod || !['ecb', 'ofb'].includes(mod)) {
        this._logData({ error: true, message: 'INIT: no encryption detected', from });
        return;
      }

      if (this.mod['A'] && this.mod['B']) {
        this.mod = {};
      }
      
      if (!this.mod['A'] && from === 'A') {
        this.mod['A'] = mod;
      } else if (!this.mod['B'] && from === 'B') {
        this.mod['B'] = mod;
      }

      this._logData({ message: `Has set the encryption: ${mod}`, from })

      if (this.mod['A'] === this.mod['B'] && this.mod['A']) {
        const enc = mod === 'ofb' ? o : e;
        const response = {
          key: enc.key,
          iv: enc.iv,
          type: 'init',
          chosenEnc: mod.toUpperCase()
        };

        this.encryption = mod;
        this.encryptionConfig = response;

        console.log(this.mod, this.encryptionConfig);

        if (withEnc && this.encryptionConfig) {
          this.AConnection.sendBytes(Buffer.from(
            this._encryptMessage(JSON.stringify(response))
          ))
          this.BConnection.sendBytes(Buffer.from(
            this._encryptMessage(JSON.stringify(response))
          ))
        } else {
          const encryptedResponse = this._encryptECB(
            JSON.stringify(response),
            shared.key
          );
          this.AConnection.sendBytes(Buffer.from(encryptedResponse));
          this.BConnection.sendBytes(Buffer.from(encryptedResponse));
        }
        return;
      }

      if (this.mod['A'] !== this.mod['B'] && this.mod['B'] && this.mod['A']) {
        const chosenEnc = Math.random() > 0.5 ? 'ofb' : 'ecb';
        const enc = chosenEnc === 'ofb' ? o : e;

        this.encryption = chosenEnc;

        const response = {
          key: enc.key,
          iv: enc.iv,
          chosenEnc: chosenEnc.toUpperCase(),
          type: 'init'
        };

        this.encryptionConfig = response;
        console.log(this.mod, this.encryptionConfig);
        
        if (withEnc && this.encryptionConfig) {
          this.AConnection.sendBytes(Buffer.from(
            this._encryptMessage(JSON.stringify(response))
          ))
          this.BConnection.sendBytes(Buffer.from(
            this._encryptMessage(JSON.stringify(response))
          ))
        } else {
          const encryptedResponse = this._encryptECB(
            JSON.stringify(response),
            shared.key,
          );
          this.AConnection.sendBytes(Buffer.from(encryptedResponse));
          this.BConnection.sendBytes(Buffer.from(encryptedResponse));
        }
      }
    };

    const handleConfirmation = from => {
      if (!this.confirmations) {
        this.confirmations = [from];
        return;
      }

      if (!this.confirmations.includes(from)) {
        this.confirmations = [...this.confirmations, from];
      }

      if (this.confirmations.length !== 2) {
        return;
      }

      let [a, b] = this.confirmations;
      if (a !== 'A') { [b, a] = [a, b]; }
      if (a !== 'A') { return; }

      console.log('Confirming %s %s', a, b);

      this.confirmations = undefined;
      this.AConnection.sendBytes(Buffer.from(
        this._encryptMessage(JSON.stringify({
          type: 'start'
        }))
      ))
      this.BConnection.sendBytes(Buffer.from(
        this._encryptMessage(JSON.stringify({
          type: 'start'
        }))
      ))
    }

    const handleUTF = (message, from) => {
      if (message.startsWith('request')) {
        return handleInit(message, from);
      }
    };

    const handleBytes = (message, from) => {
      try {
        const decrypted = this._decryptMessage(message);

        if (decrypted.startsWith('request')) {
          handleInit(decrypted, from, true);
          return;
        }

        if (decrypted === 'confirm init') {
          handleConfirmation(from);
          return;
        }

        if (decrypted === '10') {
          if (!this.ten) {
            this.ten = [from];
            return;
          }

          this.AConnection.sendBytes(Buffer.from(
            this._encryptMessage(JSON.stringify({
              type: 'continue-10'
            }))
          ))
          this.BConnection.sendBytes(Buffer.from(
            this._encryptMessage(JSON.stringify({
              type: 'continue-10'
            }))
          ))

          this.ten = undefined;
          return;
        }

        if (decrypted === 'finish') {
          console.log('Finish message from:', from);
          return;
        }
      } catch (error) {
        console.log(error);
      }
    };

    // Setting up A endpoint
    if (this.AConnection) {
      this.AConnection.on('message', message => {
        message.binaryData ? handleBytes(message.binaryData, 'A') : handleUTF(message.utf8Data, 'A');
      });
      this.AConnection.on('close', () => this.AConnection = null);
    }

    // Setting up B endpoint
    if (this.BConnection) {
      this.BConnection.on('message', message => {
        message.binaryData ? handleBytes(message.binaryData, 'B') : handleUTF(message.utf8Data, 'B');
      });
      this.BConnection.on('close', () => this.BConnection = null);
    }

    // Setting up dataClient endpoint
    if (this.dataClient) {
      this.dataClient?.on('close', () => this.dataClient = null);
    }
  }

  _handleBIncomeMessages() {
    const handleChunks = ({ chunk, file }) => {
      fs.promises.appendFile(
        path.join('./files', file),
        new Uint8Array(chunk),
      ).then(r => {
        console.log(chunk);

        this.fileChunks[file]++;
        this.AConnection.sendBytes(
          Buffer.from(this._encryptMessage(JSON.stringify({
            type: this.fileChunks[file] % 10 ? 'added' : 'wait',
            file
          })))
        );
  
        if (this.fileChunks[file] % 10 === 0) {
          this.canContinueReceiving = false;
          this.KMClient.sendBytes(Buffer.from(this._encryptMessage('10')));
          return;
        }
      });
    };

    const handleStart = data => {
      if (!fs.existsSync('./files')) {
        fs.mkdir('./files', () => {});
      }

      fs.writeFile(
        path.join('./files', data.file),
        '',
        'utf8',
        (err) => {
          if (err) {
            console.log(err);
            console.log('error on creating file');
            return;
          }

          this.canContinueReceiving = true;
          this.fileChunks[data.file] = 0;
          this.AConnection.sendBytes(
            Buffer.from(this._encryptMessage(
              JSON.stringify({ type: 'created', file: data.file }))
            )
          )
        }
      );

    };

    const handleFinish = data => {
      this.KMClient.sendBytes(
        Buffer.from(this._encryptMessage('finish'))
      );
    };

    const handleBytes = message => {
      try {
        const decrypted = this._decryptMessage(message);
        const data = JSON.parse(decrypted);
        
        if (data.type === 'start') {
          handleStart(data);
          return;
        }

        if (data.type === 'chunk') {
          handleChunks(data);
          return;
        }

        if (data.type === 'finish') {
          handleFinish(data);
          return;
        }
      } catch (error) {
        console.log(error);
      }
    }

    // Setting up A endpoint
    if (this.AConnection) {
      this.AConnection.on('message', message => {
        handleBytes(message.binaryData)
      });
      this.AConnection.on('close', () => this.AConnection = null);
    }

    // Setting up dataClient endpoint
    if (this.dataClient) {
      this.dataClient?.on('close', () => this.dataClient = null);
    }
  }

  _getConnection(name) {
    return name === 'A'
    ? this.AConnection
    : name === 'B' 
    ? this.BConnection
    : undefined;
  }

  _logData(data) {
    this.dataClient?.sendUTF(JSON.stringify(data));
  }

  _encryptECB(message, key) {
    const ecb = new ECB(hex.toBytes(key));
    return ecb.encrypt(message);
  }

  _encryptMessage(message) {
    const { chosenEnc, key, iv } = this.encryptionConfig;
    const EncClass = chosenEnc === 'OFB' ? OFB : ECB;
    const enc = new EncClass(
      hex.toBytes(key),
      iv ? hex.toBytes(iv) : undefined
    );

    return enc.encrypt(utf8.toBytes(message));
  }

  _decryptMessage(message) {
    const { chosenEnc, key, iv } = this.encryptionConfig;
    const EncClass = chosenEnc === 'OFB' ? OFB : ECB;
    const enc = new EncClass(
      hex.toBytes(key),
      iv ? hex.toBytes(iv) : undefined
    );

    const bytes = new Uint8Array(message);
    const decrypted = enc.decrypt(bytes);
    const utf = utf8.fromBytes(decrypted);
    return utf;
  }

  sendUTF(message, connection) {
    connection.sendUTF(message);
  }

  sendBytes(bytes, connection) {
    connection.sendBytes(bytes);
  }
}

module.exports = Server;