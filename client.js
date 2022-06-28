const readline = require("readline");
const net = require("net");

const getConnection = (connName) => {
  let socket = net.connect({ port: 52532, host: "10.0.0.15" }, () => {
    console.log(connName + " Connected ");

    socket.setTimeout(5000);
    socket.setEncoding("utf8");

    socket.on("data", (data) => {
      console.log(connName + " From Server: ", JSON.parse(data));
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

rl.on("line", (line) => {
  line = line.split(" ");
  switch (line[0]) {
    case "0":
      writeData(
        socket,
        '{"EventID":10040,"ClientID":"57c2416f36b34637abd4091f5792185c","Target":3,"data":{"error":0,"nick":"asdad","iconID":"RB_Playericon_005"}}'
      );
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
