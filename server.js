const readline = require("readline");
const net = require("net");

// <dev>
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.on("line", (line) => {
  switch (line) {
    case "1":
      console.log("roomMap", roomMap.size);
      break;

    case "2":
      console.log("matchingQueue", matchingQueue.length);
      break;

    case "3":
      console.log("clients", clients.length);
      break;
  }
}).on("close", () => {
  process.exit();
});
// </dev>

// <global_objects>
const clients = [];
const roomMap = new Map();
const matchingQueue = [];
let roomIdx = 0;
// </global_objects>

// class Stream {
//   constructor(EventID, data) {
//     this.EventID = EventID;
//     this.data = {
//       error: 0,
//     };
//     for (let key of Object.keys(data)) {
//       this.data[key] = data[key];
//     }
//   }
// }

// <custom_errors>
class AigearsError extends Error {
  constructor(message) {
    super(message);
    this.error = -1;
  }
}

class MatchingError extends AigearsError {
  constructor(message) {
    super(message);
    this.name = "MatchingError";
  }
}

class SocketNotInMatchingQueueError extends MatchingError {
  constructor() {
    super("이 소켓은 매칭 큐에 진입해있지 않습니다.");
    this.name = "SocketNotInMatchingQueueError";
  }
}

class SocketAlreadyInMatchingQueueError extends MatchingError {
  constructor() {
    super("이 소켓은 이미 매칭 큐에 진입해있습니다.");
    this.name = "SocketAlreadyInMatchingQueueError";
  }
}

class TargetError extends AigearsError {
  constructor(message) {
    super(message);
    this.name = "TargetError";
  }
}

class SocketNotInRoomError extends TargetError {
  constructor() {
    super("이 소켓은 방에 입장해있지 않습니다.");
    this.name = "SocketNotInRoomError";
  }
}
// </custom_errors>

const errorHandler = (e, EventID) => {
  console.error(e.name);
  if (e instanceof SyntaxError) {
    //
  } else if (e instanceof TypeError) {
    console.error(e);
    //
  } else if (e instanceof AigearsError) {
    //
  } else {
    console.error(e);
    throw e;
  }
  let packet = {
    EventID,
    data: { error: -1, name: e.name, message: e.message },
  };
  return packet;
};

const matchMaker = {
  makeMatch: (client) => {
    return new Promise((resolve, reject) => {
      client.matchFound = resolve;
      if (matchingQueue.includes(client)) {
        reject(new SocketAlreadyInMatchingQueueError());
        return;
      }
      matchingQueue.push(client);
    });
  },
  queueMonit: () => {
    setInterval(() => {
      if (matchingQueue.length > 1) {
        let player1 = matchingQueue.splice(matchMaker.getRandomIdx(), 1)[0];
        let player2 = matchingQueue.splice(matchMaker.getRandomIdx(), 1)[0];
        matchMaker.makeRoom(player1, player2);
      }
    }, 300);
  },
  makeRoom: (player1, player2) => {
    roomMap.set(roomIdx, {
      player1,
      player2,
    });
    player1.playerNum = 1;
    player2.playerNum = 2;
    player1.roomIdx = roomIdx;
    player2.roomIdx = roomIdx;
    player1.matchFound();
    player2.matchFound();
    roomIdx++;
  },
  getRandomIdx: () => {
    return Math.round(Math.random() * (matchingQueue.length - 1));
  },
};

const targetIgnoreWork = (client, data) => {
  switch (data.EventID) {
    case 10040: //매칭 큐 진입
      client.nick = data.data.nick;
      client.iconID = data.data.iconID;
      sendPacketTo(client, {
        EventID: 20040,
        data: {
          error: 0,
          roomIdx: client.roomIdx,
          message: "매치 큐 대기중",
        },
      });
      (async () => {
        try {
          await matchMaker.makeMatch(client);
        } catch (e) {
          if (e instanceof SocketAlreadyInMatchingQueueError) {
            let packet = errorHandler(e, data.EventID);
            sendPacketTo(client, packet);
            return;
          } else {
            throw e;
          }
        }
        let isPlayer1 = client.playerNum === 1;
        let player1 = roomMap.get(client.roomIdx).player1;
        let player2 = roomMap.get(client.roomIdx).player2;

        sendPacketTo(client, {
          EventID: 20041,
          data: {
            error: 0,
            roomIdx: client.roomIdx,
            message: "매칭 완료",
            nick: isPlayer1 ? player2.nick : player1.nick,
            iconID: isPlayer1 ? player2.iconID : player1.iconID,
          },
        });
      })();
      break;

    case 10041: //매칭 큐 탈출
      if (!matchingQueue.includes(client)) {
        throw new SocketNotInMatchingQueueError();
      }
      for (let i in matchingQueue) {
        if (client.id === matchingQueue[i].id) {
          matchingQueue.splice(i, 1);
          sendPacketTo(client, {
            EventID: 20042,
            data: {
              error: 0,
              message: "매칭 취소됨",
            },
          });
          return;
        }
      }
      break;

    case 10050: // 방 탈출
      leaveRoom(client, (notShuttingDown = true));

    default:
  }
};

// <io_functions>
const numberToUInt32Array = (num) => {
  num = num + 4;
  let arr = [0, 0, 0, 0];
  for (let i = 1; i <= num; i++) {
    arr[0]++;
    if (arr[0] > 255) {
      arr[0] = 0;
      arr[1]++;
    }
    if (arr[1] > 255) {
      arr[1] = 0;
      arr[2]++;
    }
    if (arr[2] > 255) {
      arr[2] = 0;
      arr[3]++;
    }
    if (arr[3] > 255) throw new Error();
  }
  return arr;
};
const leaveRoom = (client, notShuttingDown) => {
  if (client.roomIdx === null || client.roomIdx === undefined) {
    if (notShuttingDown) throw new SocketNotInRoomError();
  } else {
    if (roomMap.get(client.roomIdx) === undefined) return;

    let player1 = roomMap.get(client.roomIdx).player1;
    let player2 = roomMap.get(client.roomIdx).player2;

    let otherPlayer = client.id === player1.id ? player2 : player1;

    sendPacketTo(client, {
      EventID: 20051,
      data: {
        error: 0,
        message: "자신이 방을 떠남",
      },
    });
    sendPacketTo(otherPlayer, {
      EventID: 20052,
      data: {
        error: 0,
        message: "상대가 방을 떠남",
      },
    });

    roomMap.delete(client.roomIdx);
    client.roomIdx = null;
  }
};
const getTarget = (client, data) => {
  let target = null;
  switch (data.Target) {
    case -1: //None
      target = client;
      break;

    case 0: //자신만
      target = client;
      break;

    case 1: //방 안 모두
      if (client.roomIdx === undefined || client.roomIdx === null)
        throw new SocketNotInRoomError();
      target = [];
      target.push(roomMap.get(client.roomIdx).player1);
      target.push(roomMap.get(client.roomIdx).player2);
      break;

    case 2: //방 안 나빼고 모두
      if (client.roomIdx === undefined || client.roomIdx === null)
        throw new SocketNotInRoomError();
      target =
        client.id === roomMap.get(client.roomIdx).player1.id
          ? roomMap.get(client.roomIdx).player2
          : roomMap.get(client.roomIdx).player1;
      break;

    case 3: //모두
      target = clients;
      break;

    case 4: //나 빼고 모두
      target = [];
      for (let c of clients) {
        if (client.id !== c.id) target.push(c);
      }
      break;

    default:
      throw new TargetError();
  }

  return target;
};
const sendPacketTo = (target, data) => {
  if (target === false) return;
  if (Array.isArray(target)) {
    for (let t of target) {
      writeData(t, data);
    }
  } else {
    writeData(target, data);
  }
};
const writeData = function (socket, data) {
  let header = null;
  let packet = null;
  try {
    if (socket.destroyed) return;
    data = JSON.stringify(data);
    data = Buffer.from(data);
    header = Buffer.from(numberToUInt32Array(data.length));
    packet = Buffer.concat([header, data]);

    // console.log(packet.length);
    let success = !socket.write(packet);
    if (!success) {
      ((socket, packet) => {
        socket.once("drain", () => {
          writeData(socket, packet);
        });
      })(socket, packet);
    }
  } catch (e) {
    console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", socket);

    errorHandler(e);
    return;
  }
};
// </io_functions>

const log = (data) => {
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
      date.getSeconds() +
      "\n",
    data
  );
};

const server = net.createServer((client) => {
  client.on("error", (e) => {
    if (e.code === "ECONNRESET") console.log(client.idx, e.code);
    else console.error("client error", e);
  });
  client.on("destroy", (e) => {
    console.error("destroyed", e);
    console.log(client.id);
  });
  // client.on("timeout", () => {}); //TODO: 타임아웃 활용?
  // client.setTimeout(10000);
  // client.setEncoding("utf8");
  client.id = Symbol("id");
  client.idx = clients.length;
  client.tempBody = Buffer.alloc(0);

  console.log("New Connection idx : ", client.idx);

  clients.push(client);

  client.on("close", () => {
    try {
      if (client.roomIdx !== null || client.roomIdx !== undefined)
        leaveRoom(client, (notShuttingDown = false));

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
    } catch (e) {
      errorHandler(e);
    }
  });

  client.on("data", (data) => {
    // log(data.toString());
    let target = false;
    let packet = null;
    try {
      for (let d of data) {
        client.packetComplete = false;
        client.tempBody = Buffer.concat([client.tempBody, Buffer.from([d])]);

        if (client.tempBody.length === 4) {
          client.header = client.tempBody;
          client.packetLength = client.header.readUint32LE();
          // console.log(client.packetLength);
        }

        if (client.tempBody.length === client.packetLength) {
          client.jsonStr = client.tempBody.subarray(4).toString();
          client.tempBody = Buffer.alloc(0);
          client.bodyLength = null;
          client.packetComplete = true;
        }

        if (client.packetComplete) {
          let body = JSON.parse(client.jsonStr);
          log(body);

          if (10000 <= body.EventID && body.EventID < 20000) {
            // target = false; // finally에서 send하지않기위해
            targetIgnoreWork(client, body);
          } else {
            target = getTarget(client, body);
            packet = body;
          }
        }
      }
    } catch (e) {
      packet = errorHandler(e, data.EventID);
      target = client;
    } finally {
      sendPacketTo(target, packet);
    }
  });
});

server.listen((port = 52531), (host = "10.0.0.15"), () => {
  console.log("listening ", host, ":", port);
  server.on("close", () => {
    console.log("server close");
  });
  server.on("error", (e) => {
    console.error("server error", e);
  });
  server.on("connection", (e) => {});
});

matchMaker.queueMonit();
