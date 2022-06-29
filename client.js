const { Buffer } = require("buffer");
const readline = require("readline");
const net = require("net");

const getConnection = (connName) => {
  let socket = net.connect({ port: 52532, host: "10.0.0.15" }, () => {
    console.log(connName + " Connected ");

    socket.setTimeout(5000);
    socket.setEncoding("utf8");

    socket.on("data", (data) => {
      console.log(
        connName + " From Server: ",
        JSON.stringify(JSON.parse(data))
      );
    });
    socket.on("end", (msg) => {
      console.log(connName + " Client disconnected: " + msg);
    });
    socket.on("error", (err) => {
      console.log("Socket Error: ", JSON.stringify(err));
    });
    socket.on("timeout", () => {
      // socket.end("timeout");
    });
    socket.on("close", () => {
      console.log("Socket Closed");
    });
  });
  return socket;
};

let socket = getConnection("test");

const writeData = function (socket, data) {
  let success = !socket.write(data);
  if (!success) {
    ((socket, data) => {
      socket.once("drain", function () {
        writeData(socket, data);
      });
    })(socket, data);
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let header = Buffer.from([17, 0, 0, 0]);
let body = Buffer.from('{"data":"hi"}');
let body_piece1 = Buffer.from('{"data":"hi"');
let body_piece2 = Buffer.from("}");

// let buffer_a = Buffer.concat([header, body_piece1]);
// let buffer_b = body_piece2;
// let buffer_c = Buffer.concat([header, body]);
// let buffer_d = Buffer.concat([header, body, header, body_piece1]);
let buffer_e = Buffer.concat([header, body, header, body_piece1]);

rl.on("line", (line) => {
  line = line.split(" ");
  switch (line[0]) {
    case "header":
      writeData(socket, header);
      break;
    case "body":
      writeData(socket, body);
      break;
    case "1":
      writeData(socket, body_piece1);
      break;
    case "2":
      writeData(socket, body_piece2);
      break;
    case "00":
      writeData(socket, buffer_e);
      break;

    case "-1":
      writeData(socket, '{"');
      break;

    case "1":
      writeData(
        socket,
        JSON.stringify({
          EventID: parseInt(line[1]),
          ClientID: "clientid",
          Target: parseInt(line[2]),
          data: {},
        })
      );
      break;

    case "2":
      socket.destroy();
      break;

    case "3":
      socket.end();
      break;
  }
}).on("close", () => {
  process.exit();
});
