const { Buffer } = require("buffer");
const readline = require("readline");
const net = require("net");

let header = null;
let tempBody = Buffer.alloc(0);
let jsonStr = "";
let packetComplete = false;
let packetLength = null;

const getConnection = (connName) => {
  let socket = net.connect({ port: 52532, host: "10.0.0.15" }, () => {
    console.log(connName + " Connected ");

    socket.setTimeout(5000);
    // socket.setEncoding("utf8");

    socket.on("data", (data) => {
      // console.log(
      //   connName + " From Server: ",
      //   // JSON.stringify(JSON.parse(data))
      //   data
      // );
      try {
        for (let d of data) {
          packetComplete = false;
          tempBody = Buffer.concat([tempBody, Buffer.from([d])]);

          if (tempBody.length === 4) {
            for (let t of tempBody) {
              console.log(t);
            }
            header = tempBody;
            packetLength = header.readUint32LE();
            console.log("packetLength", packetLength);
          }

          if (tempBody.length === packetLength) {
            jsonStr = tempBody.subarray(4).toString();
            tempBody = Buffer.alloc(0);
            packetComplete = true;
          }

          if (packetComplete) {
            let body = JSON.parse(jsonStr);
            console.log(body);
            // console.log(jsonStr);
            // console.log("jsonStr.length", jsonStr.length);
          }
        }
      } catch (e) {
        console.error(e);
      }
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
    case "1":
      writeData(
        socket,
        makePacket({
          EventID: parseInt(line[1]),
          ClientID: "clientid",
          Target: parseInt(line[2]),
          data: {},
        })
      );
      break;
    case "2":
      writeData(
        socket,
        makePacket({
          EventID: 10040,
          ClientID: "clientid",
          Target: 0,
          data: { iconID: line[1], nick: line[2] },
        })
      );
      break;
  }
}).on("close", () => {
  process.exit();
});

const makePacket = (obj) => {
  let json = JSON.stringify(obj);
  let header = Buffer.from([json.length + 4, 0, 0, 0]);
  let body = Buffer.from(json);

  return Buffer.concat([header, body]);
};
