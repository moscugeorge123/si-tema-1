process.title = 'A-node';

const configs = require('../config');
const { A, B, KM } = configs;
const { waitServer, command, isRequestInit, decryptMessage, encryptMessage } = require('../utils');
const Client = require('../client');
const color = require('chalk');
const fs = require('fs');

const KMClient = new Client();
const BClient = new Client();

let listeningOnA = true;
let listeningOnKM = true;

(async function waitUntilConnected () {
  try {
    if (listeningOnA) {
      // console.log('Trying to connect on: %s', B.port)
      await waitServer(B);
      console.log(color.green('-> Port %s is up'), B.port)
      listeningOnA = false;
    }
    
    if (listeningOnKM) {
      // console.log('Trying to connect on: %s', KM.port)
      await waitServer(KM);
      console.log(color.green('-> Port %s is up'), KM.port)
      listeningOnKM = false;
    }
  } catch (error) {
    waitUntilConnected();
    return;
  }

  try {
    await KMClient.connect(KM, `endpoint-${A.port}`);
    console.log(color.green('-> Connected to KM'));

    KMClient.onMessage(message => {
      try {
        const decrypted = decryptMessage(message.binaryData, KMClient);

        if (decrypted.type === 'init') {
          KMClient.kmDecrypt = decrypted.chosenEnc;
          KMClient[KMClient.kmDecrypt] = decrypted;

          KMClient.sendBytes(Buffer.from(encryptMessage('confirm init', KMClient)));
          return;
        }
        
        if (decrypted.type === 'start') {
          console.log(color.blue(`Encryption "${KMClient.kmDecrypt}" is set. `));
          command(processCommands);
          return;
        }

        if (decrypted.type === 'continue-10') {
          console.log(color.blue(`Sent ${BClient.sentChunks} chunks.`));
          sendChunk();
          return;
        }
      } catch (error) {
        command(processCommands);
        console.log('ERROR ON DECRYPTION');
        console.log(error);
      }
    });

    await BClient.connect(B, `endpoint-${A.port}`);
    console.log(color.green('-> Connected to B'));

    BClient.onMessage(message => {
      try {
        const decrypted = decryptMessage(message.binaryData, KMClient);

        if (decrypted.type === 'created') {
          sendChunk();
          return;
        }

        if (decrypted.type === 'added') {
          sendChunk();
          return;
        }
      } catch (error) {
        console.log('ERROR ON DECRYPTION B');
        console.log(error);
      }
    });

    command(requestInit);
  } catch (error) {
    command(processCommands);
    console.log(error);
  }
})();

function requestInit(commandLine) {
  if (!commandLine) {
    command(requestInit);
    return;
  }
  
  if (!isRequestInit(commandLine)) {
    console.log(color.red('First you need to set an encryption'));
    command(requestInit);
  }

  const [, e] = commandLine.split(' ');
  console.log(color.blue('Requesting %s...'), e.toUpperCase());
  KMClient.sendUTF(commandLine);
}

function processCommands(commandLine) {
  if (!commandLine) {
    command(processCommands);
    return;
  }

  if (commandLine.startsWith('send')) {
    handleSendFile(commandLine);
    return;
  }

  if (commandLine.startsWith('request')) {
    handleRequest(commandLine);
    return;
  }
}

async function handleSendFile(command) {
  const [, file] = command.split(' ');

  try {
    const data = await fs.promises.readFile(file);
    BClient.fileData = Array.from(new Uint8Array(data));
    BClient.fileStart = -1;
    // BClient.chunkSize = 16;
    BClient.chunkSize = 128 * 16;
    BClient.fileName = file;
    BClient.sentChunks = 0;

    sendChunk();
  } catch (error) {
    console.log(error);
  }
}

function sendChunk() {
  let { fileData, fileStart, fileName: file, chunkSize } = BClient;
  if (fileStart === -1) {
    sendToBClient({ file, type: 'start' });
    BClient.fileStart++;
    return;
  }

  if (fileData.length <= fileStart) {
    sendToBClient({ type: 'finish', file });
    KMClient.sendBytes(Buffer.from(encryptMessage('finish', KMClient)));
    setTimeout(() => command(processCommands), 200);
    return;
  }

  const size = Math.min(fileData.length - fileStart, chunkSize);
  const chunk = fileData.slice(fileStart, fileStart + size);
  BClient.fileStart += size;
  BClient.sentChunks++;
  sendToBClient({ file, chunk, type: 'chunk', all: false });

  console.log(chunk);

  if (BClient.sentChunks > 0 && BClient.sentChunks % 10 === 0) {
    KMClient.sendBytes(Buffer.from(encryptMessage('10', KMClient)));
  }
}

function sendToBClient(data) {
  BClient.sendBytes(
    Buffer.from(encryptMessage(JSON.stringify(data), KMClient))
  );
}

function handleRequest(command) {
  const [, e] = command.split(' ');
  console.log(color.blue('Requesting %s...'), e.toUpperCase());
  KMClient.sendBytes(Buffer.from(encryptMessage(command, KMClient)));
}
