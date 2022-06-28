const { checkPrimeSync } = require("crypto");
const net = require("net");

let isPlayer1Occupied = false;
let clients = [];
const server = net.createServer((client) => {
  client.on("error", (err) => {
    console.error(err);
  });
  client.on("timeout", () => {
    console.log("timeout");
  });
  client.setTimeout(500);
  client.setEncoding("utf8");

  clients.push(client);
  hi();

  client.on("data", (data) => {
    try {
      data = JSON.parse(data);
    } catch (err) {
      console.error(err);
      return;
    }
    console.log(data);
    let event = data._event;
    switch (eventID) {
      case "sphereMoving":
        for (let i in clients) {
          writeData(
            clients[i],
            JSON.stringify({
              sort: "sphereMoving",
              x: data.x,
              y: data.y,
              z: data.z,
              playerNum: data.playerNum,
            })
          );
        }
        return;
      case "connection":
        writeData(
          client,
          JSON.stringify({
            sort: "connection",
            playerNum: isPlayer1Occupied === true ? 2 : 1,
          })
        );
        isPlayer1Occupied = !isPlayer1Occupied;
        return;
      default:
        writeData(client, JSON.stringify(data));
    }
  });

  client.on("end", () => {
    for (let i in clients) {
      if (clients[i] === client) {
        console.log(i);
        clients.splice(i, 1);
      }
    }
    hi();
    server.getConnections((err, count) => {
      console.log(
        "Remaining Connections: ",
        count,
        ", in array: ",
        clients.length
      );
    });
  });
});

server.listen((port = 52531), (host = "10.0.0.15"), () => {
  server.on("close", () => {
    console.log("서버 종료");
  });
  server.on("error", (err) => {
    console.log("서버 에러", err);
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

function hi() {
  console.log(clients.length);
}
