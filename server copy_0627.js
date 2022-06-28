const net = require("net");

let clients = [];
const server = net.createServer((client) => {
  client.on("error", (e) => {
    console.error(e);
  });
  client.on("timeout", () => {});

  client.setTimeout(500);
  client.setEncoding("utf8");
  client.id = Symbol("id");
  client.idx = clients.length;

  console.log(`New Connection idx : ${client.idx}`);

  clients.push(client);

  client.on("data", (data) => {
    let date = new Date();
    console.log(
      date.getMonth() +
        1 +
        "-" +
        date.getDate() +
        " " +
        date.getHours() +
        ":" +
        date.getMinutes() +
        ":" +
        date.getSeconds()
    );
    console.log(data);

    let str_packetSize = "";
    let packetSize = 0;
    let str_packetID = "";
    let packetID = 0;
    let str_seqNum = "";
    let seqNum = 0;
    let str_rmiContext = "";
    let rmiContext = 0;
    let str_recvData = "";
    let recvData = [];

    let i = 0;
    for (let byte of data) {
      if (i < 4) {
        str_packetSize += " " + byte;
        packetSize += byte;
      } else if (i < 8) {
        str_packetID += " " + byte;
        packetID += byte;
      } else if (i < 12) {
        str_seqNum += " " + byte;
        seqNum += byte;
      } else if (i == 12) {
        str_rmiContext += " " + byte;
        rmiContext += byte;
      } else {
        break;
      }
      i++;
    }

    console.log(
      `${packetSize} / ${packetID} / ${seqNum} / ${rmiContext} / ${str_recvData}`,
      recvData
    );

    for (let client of clients) {
      writeData(client, data);
    }
  });

  client.on("end", () => {
    let logStr = "";
    for (let i in clients) {
      if (clients[i].id === client.id) {
        logStr += `clients[i].idx: ${clients[i].idx}`;
        clients.splice(i, 1);
      }
    }
    server.getConnections((e, count) => {
      logStr += `, clients[].length: ${clients.length}, server.getConnections(): ${count}`;
      console.log(logStr);
    });
  });
});

server.listen((port = 52531), (host = "10.0.0.15"), () => {
  server.on("close", () => {
    console.log("서버 종료");
  });
  server.on("error", (e) => {
    console.log("서버 에러", e);
  });
  server.on("connection", (e) => {
    console.log("ㅎㅇ");
  });
});

const writeData = function (socket, data) {
  if (socket.destroyed) return;
  let success = !socket.write(data);
  if (!success) {
    ((socket, data) => {
      socket.once("drain", () => {
        writeData(socket, data);
      });
    })(socket, data);
  }
};

class MyError extends Error {
  constructor(message) {
    super(message);
    this.name = "MyError";
  }
}
