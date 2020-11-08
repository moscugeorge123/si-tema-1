process.title = 'B-node';

const { B, KM } = require('../config');
const { waitServer, command, isRequestInit, decryptMessage, encryptMessage } = require('../utils');
const Server = require('../server');
const Client = require('../client');
const color = require('chalk');

const client = new Client();
const server = new Server('B');

let listeningOnKM = true;
(async function waitUntilConnected () {
  try {
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
    await client.connect(KM, `endpoint-${B.port}`);
    console.log(color.green('-> Connected to KM'));

    command(requestInit);
    client.onMessage(message => {
      try {
        const decrypted = decryptMessage(message.binaryData, client);

        if (decrypted.type === 'init') {
          client.kmDecrypt = decrypted.chosenEnc;
          client[client.kmDecrypt] = decrypted;
          server.encryptionConfig = decrypted;

          client.sendBytes(Buffer.from(encryptMessage('confirm init', client)));
          return;
        }
        
        if (decrypted.type === 'start') {
          console.log(color.blue(`Encryption "${client.kmDecrypt}" is set. `));
          command(processCommands);
          return;
        }

        if (decrypted.type === 'continue-10') {
          server.canContinueReceiving = true;
          return;
        }

      } catch (error) {
        console.log('ERROR ON DECRYPTION');
        console.log(error);
      }
    });
  } catch (error) {
    console.log(error);
  }
})();

server.setServer();
server.KMClient = client;

function requestInit(commandLine) {
  if (!commandLine) {
    command(requestInit);
    return;
  }
  
  if (!isRequestInit(commandLine)) {
    console.log(color.red('First you need to set an encryption'));
    command(requestInit);
  }

  if (commandLine.startsWith('send')) {
    console.log(color.red('"send" is not allowed here!'));
    command(requestInit);
    return;
  }

  const [, e] = commandLine.split(' ');
  console.log(color.blue('Requesting %s...'), e.toUpperCase());
  client.sendUTF(commandLine);
}

function processCommands(commandLine) {
  if (!commandLine) {
    command(processCommands);
    return;
  }

  if (commandLine.startsWith('request')) {
    handleRequest(commandLine);
    return;
  }

  if (commandLine.startsWith('send')) {
    console.log(color.red('"send" is not allowed here!'));
    command(processCommands);
    return;
  }
}

function handleRequest(command) {
  const [, e] = command.split(' ');
  console.log(color.blue('Requesting %s...'), e.toUpperCase());
  client.sendBytes(Buffer.from(encryptMessage(command, client)));
}
