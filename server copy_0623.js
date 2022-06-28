const net = require("net");

let isPlayer1Occupied = false;
let clients = [];
const server = net.createServer((client) => {
  client.on("error", (e) => {
    console.error(e);
  });
  client.on("timeout", () => {});

  client.setTimeout(500);
  // client.setEncoding("utf8");
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
    // console.log(typeof data);
    // console.log(data.__proto__);
    console.log(data);

    let a = data[0];
    console.log(parseInt(a, 16));
    // writeData(client, data);

    // var byteArrayToInt = function (byteArray) {
    //   var value = 0;
    //   for (var i = byteArray.length - 1; i >= 0; i--) {
    //     value = value * 256 + byteArray[i];
    //   }

    //   return value;
    // };
    // console.log(byteArrayToInt(data));
    // try {
    //   data = JSON.parse(data);
    //   if (
    //     data.eventID === undefined ||
    //     data.userUUID === undefined ||
    //     data.message === undefined
    //   )
    //     throw "";
    // } catch (e) {
    //   if (e instanceof SyntaxError) {
    //     writeData(client, "syntax error");
    //     return;
    //   } else {
    //     throw e;
    //   }
    // }
    // console.log("data", data);
    // let eventID = data.eventID;
    // switch (eventID) {
    //   case -1:
    //     writeData(
    //       client,
    //       JSON.stringify({
    //         sort: "connection",
    //         playerNum: isPlayer1Occupied === true ? 2 : 1,
    //       })
    //     );
    //     isPlayer1Occupied = !isPlayer1Occupied;
    //     return;
    //   case -2:
    //     for (let i in clients) {
    //       writeData(
    //         clients[i],
    //         JSON.stringify({
    //           sort: "sphereMoving",
    //           x: data.x,
    //           y: data.y,
    //           z: data.z,
    //           playerNum: data.playerNum,
    //         })
    //       );
    //     }
    //     return;
    //   default:
    //     writeData(client, JSON.stringify(data));
    // }
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
