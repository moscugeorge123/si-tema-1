const WebSocketClient = require('websocket').client;

class Client {
  constructor() {
    this.socket = new WebSocketClient();
  }

  connect = ({ address, port }, origin) => new Promise((resolve, reject) => {
    this.address = address;
    this.port = port;

    this.socket.connect(`ws://${address}:${port}`, null, origin);
    this.socket.on('connect', connection => {
      this.connection = connection;
      this.handleError(connection);
      this.handleClose(connection);

      resolve(connection);
    });
    this.socket.on('connectFailed', reject);
  });

  handleError(connection) {
    connection.on('error', error => {
      console.log('client-connection error', error);
    });
  }

  handleClose(connection) {
    connection.on('close', () => {
      console.log('client-connection closed');
      process.exit();
    });
  }

  onMessage(callback) {
    this.connection.on('message', ({ utf8Data, binaryData, type }) => {
      callback({
        utf8Data,
        binaryData,
        type,
      });
    });
  }

  sendUTF(message) {
    if (this.connection.connected) {
      this.connection.sendUTF(message);
    } else {
      console.log(`Not connected to: ${this.address}:${this.port}`);
    }
  }

  sendBytes(buffer) {
    if (this.connection.connected) {
      this.connection.sendBytes(buffer);
    } else {
      console.log(`Not connected to: ${this.address}:${this.port}`);
    }
  }
}

module.exports = Client;
