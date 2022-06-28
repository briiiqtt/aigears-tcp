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

// <custom_errors>
class MatchingError extends Error {
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

class TargetError extends Error {
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

const exceptionHandler = (e) => {
  console.error(e.name);
  let errObj = { result: "error", name: e.name, message: e.message };
  if (e instanceof SyntaxError) {
    // 보통 JSON파싱 익셉션
  }
  //  else if (e instanceof TypeError) {
  //   // 처리 해줘야하나 보류
  // }
  else if (e instanceof TargetError) {
    //
  } else if (e instanceof MatchingError) {
    //
  } else {
    console.error(e);
    throw e;
  }
  return errObj;
};

const matchMaker = {
  makeMatch: (client) => {
    return new Promise((resolve, reject) => {
      client.resolve = resolve;
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
    player1.roomIdx = roomIdx;
    player2.roomIdx = roomIdx;
    player1.resolve();
    player2.resolve();
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
      sendDataTo(client, {
        EventID: 20040,
        data: { roomIdx: client.roomIdx, message: "매치 큐 대기중" },
      });
      (async () => {
        await matchMaker.makeMatch(client);
        let isPlayer1 = client.id === roomMap.get(client.roomIdx).player1.id;
        let player1 = roomMap.get(client.roomIdx).player1;
        let player2 = roomMap.get(client.roomIdx).player2;

        sendDataTo(client, {
          EventID: 20041,
          data: {
            roomIdx: client.roomIdx,
            message: "매칭 완료",
            enemyNick: isPlayer1 ? player2.nick : player1.nick,
            enemyIconID: isPlayer1 ? player2.iconID : player1.iconID,
          },
        });
      })();
      break;

    case 10041: //매칭 큐 탈출
      for (let i in matchingQueue) {
        if (client.id === matchingQueue[i].id) {
          matchingQueue.splice(i, 1);
          sendDataTo(client, {
            EventID: 20042,
            data: {
              message: "매칭 취소됨",
            },
          });
          return;
        }
      }
      throw new SocketNotInMatchingQueueError();
      break;

    default:
  }
};

// <io_functions>
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
const sendDataTo = (target, data) => {
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
  try {
    if (socket.destroyed) return;
    data = JSON.stringify(data);
  } catch (e) {
    exceptionHandler(e);
    return;
  }
  let success = !socket.write(data);
  if (!success) {
    ((socket, data) => {
      socket.once("drain", () => {
        writeData(socket, data);
      });
    })(socket, data);
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
  client.setEncoding("utf8");
  client.id = Symbol("id");
  client.idx = clients.length;

  console.log(`New Connection idx : ${client.idx}`);

  clients.push(client);

  client.on("close", () => {
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

  client.on("data", (data) => {
    let target = null;
    try {
      log(data);
      data = JSON.parse(data);

      if (10000 <= data.EventID && data.EventID < 20000) {
        targetIgnoreWork(client, data);
        target = false;
      } else {
        target = getTarget(client, data);
      }
    } catch (e) {
      data = exceptionHandler(e);
      target = client;
    } finally {
      sendDataTo(target, data);
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
