const portFinder = require('portfinder');
const fs = require('fs');
const { ECB, OFB, hex, utf8 } = require('./aes');
const configs = require('./config');
const color = require('chalk');

const rl = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const actions = ['request', 'send'];

const waitServer = ({ port, address: host }) => new Promise((resolve, reject) => {
  setTimeout(async () => {
    try {
      await portFinder.getPortPromise({
        port,
        host,
        stopPort: port,
        startPort: port,
      });
      reject(`Error on port: ${port}`);
    } catch (error) {
      resolve(true);
    }
  }, 250);
}); 

const getCommand = callback => {
  rl.question(color.green('$action: '), response => {
    callback(response);
  })
};

function validateCommand(command) {
  const action = command.split(' ')?.[0];
  if (!action) {
    console.log(`You need to write an action`);
    return false;
  }

  if (!actions.includes(action)) {
    console.log(color.red(`"${action}" is not a valid action`));
    return;
  }

  if (action === 'request' && !isRequestInit(command)) {
    console.log(color.red(`"request" should be called with "ecb" or "ofb" as parameter`));
    return;
  }

  if (action === 'send' && !isSendFile(command)) {
    return;
  }

  return action;
}

function command(callback) {
  getCommand(response => {
    if (!validateCommand(response)) {
      command(callback);
      callback(undefined);
      return;
    }

    callback(response);
  });
}

function isRequestInit(command) {
  const [c, enc] = command.split(' ');
  return ['ecb', 'ofb'].includes(enc?.trim()) && c === 'request';
}

function isSendFile(command) {
  const [c, file] = command.split(' ');
  if (c !== 'send') {
    return;
  }

  if (!file) {
    console.log(color.red(`"send" should have a path file as parameter`));
    return;
  }

  if (!fs.existsSync(file)) {
    console.log(color.red(`"${file}" does not exists`));
    return;
  }

  const stat = fs.statSync(file);
  if (!stat.isFile()) {
    console.log(color.red(`"${file}" should be a file`));
    return;
  }

  return true;
}

function decryptMessage(binaryData, client) {
  const bytes = new Uint8Array(binaryData);
  let key, iv, EncClass;

  if (client.kmDecrypt) {
    ({ key, iv } = client[client.kmDecrypt]);
    EncClass = client.kmDecrypt === 'ECB' ? ECB : OFB;
  } else {
    ({ key } = configs.shared);
    EncClass = ECB;
  }

  const enc = new EncClass(hex.toBytes(key), iv ? hex.toBytes(iv) : undefined);
  const decrypted = enc.decrypt(bytes);
  const json = utf8.fromBytes(decrypted);
  return JSON.parse(json);
}

function encryptMessage(message, client) {
  const { key, iv } = client[client.kmDecrypt];
  const enc = new (client.kmDecrypt === 'ECB' ? ECB : OFB)(
    hex.toBytes(key),
    iv ? hex.toBytes(iv) : undefined
  );

  const bytes = utf8.toBytes(message);
  const encrypted = enc.encrypt(bytes);
  return encrypted;
}

module.exports = {
  decryptMessage,
  encryptMessage,
  waitServer,
  command,
  isRequestInit,
}