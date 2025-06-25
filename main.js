const http = require("http");
const express = require("express");
const url = require("url");
const app = express();

const employeesOnlyMap = new Map();
const tournamentMap = new Map();
const tournamentsOfClubMap = new Map();

app.use(express.static("public"));
// require("dotenv").config();

const serverPort = process.env.PORT || 3000;
const server = http.createServer(app);
const WebSocket = require("ws");

let keepAliveId;

const wss =
  process.env.NODE_ENV === "production"
    ? new WebSocket.Server({ server })
    : new WebSocket.Server({ port: 5001 });

server.listen(serverPort);
console.log(`Server started on port ${serverPort} in stage ${process.env.NODE_ENV}`);

wss.on("connection", function (ws, req) {
  console.log("Connection Opened!");
  console.log("Client size: ", wss.clients.size);

  const queryParams = url.parse(req.url, true).query;
  
  const clientId = queryParams.clientId;
  const clubId = queryParams.clubId;
  const tournamentId = queryParams.tournamentId;
  const employeesOnly = !!queryParams.employeesOnly;

  if (clientId !== undefined && clubId !== undefined) {
    if (tournamentId === undefined) {
      tournamentsOfClubMap.set(
        clientId, 
        {
          ws: ws,
          clubId: clubId
        }
      );
    } else if (employeesOnly === true) {
      employeesOnlyMap.set(
        clientId, 
        {
          ws: ws,
          clubId: clubId
        } 
      );
    } else {
      tournamentMap.set(
        clientId, 
        {
          ws: ws,
          tournamentId: tournamentId,
          clubId: clubId
        }
      );
    }
  }
  
  
  if (wss.clients.size === 1) {
    console.log("first connection. starting keepalive");
   // keepServerAlive();
  }

  ws.on("message", (data) => {
    const stringifiedData = data.toString();
    const parsedData = JSON.parse(stringifiedData);
    const scope = parsedData.scope;

    if (stringifiedData === 'pong' || scope === 'HEARTBEAT') {
      console.log('keepAlive');
      return;
    }
    
    broadcast(ws, stringifiedData, parsedData);
  });

  ws.on("close", (data) => {
    console.log("closing connection");

    if (wss.clients.size === 0) {
      console.log("last client disconnected, stopping keepAlive interval");
      clearInterval(keepAliveId);
    }
  });
});

// Implement broadcast function because of ws doesn't have it
const broadcast = (ws, message, data) => {
    const clientId = data.clientId;
      removeAllClosedClients();
  
    if (data.scope === 'TOURNAMENT') {
      console.log('BROADCASTING TO TOURNAMENT', data.tournamentId, 'in club', data.clubId);
      [...tournamentMap]
        .filter(([key, _]) => key !== clientId)
        .map(([key, clientConfig]) => ({cId: key, clientConfig: clientConfig}))
        .forEach(pair => {
          console.log('check client', pair.cId);

          console.log(pair.clientConfig.ws.readyState, WebSocket.CLOSED)

          const shouldBroadcast = pair.clientConfig.ws !== ws 
          && pair.clientConfig.ws.readyState === WebSocket.OPEN
          && +data.clubId === +pair.clientConfig.clubId
          && +data.tournamentId === +pair.clientConfig.tournamentId
        

          console.log('should broadcast', shouldBroadcast);

          if (shouldBroadcast) {
            console.log('==> SENDING TO CLIENT', pair.cId)
            pair.clientConfig.ws.send(message);
          }
        });
        
      console.log('BROADCASTING TO ALL TOURNAMENTS IN CLUB', data.clubId);
      [...tournamentsOfClubMap]
        .filter(([key, _]) => key !== clientId)
        .map(([key, clientConfig]) => ({cId: key, clientConfig: clientConfig}))
        .forEach(pair => {
          console.log('check client', pair.cId);

          console.log(pair.clientConfig.ws.readyState, WebSocket.CLOSED)

          const shouldBroadcast = pair.clientConfig.ws !== ws 
          && pair.clientConfig.ws.readyState === WebSocket.OPEN
          && +data.clubId === +pair.clientConfig.clubId

          console.log('should broadcast', shouldBroadcast);

          if (shouldBroadcast) {
            pair.clientConfig.ws.send(message);
          }
        });
    }

    if (data.scope === 'EMPLOYEES') {
      console.log('BROADCASTING TO ALL EMPLOYEES IN CLUB', data.clubId);
      [...employeesOnlyMap]
        .filter(([key, _]) => key !== clientId)
        .map(([key, clientConfig]) => ({cId: key, clientConfig: clientConfig}))
        .forEach(pair => {
          console.log('check client', pair.cId);

          console.log(pair.clientConfig.ws.readyState, WebSocket.CLOSED)

          const shouldBroadcast = pair.clientConfig.ws !== ws 
          && pair.clientConfig.ws.readyState === WebSocket.OPEN
          && +data.clubId === +pair.clientConfig.clubId

          console.log('should broadcast', shouldBroadcast);

          if (shouldBroadcast) {
            pair.clientConfig.ws.send(message);
          }
        });
  }
};

const removeAllClosedClients = () => { 
  const closedEmployeesOnlyClients = [];
  [...employeesOnlyMap]
        .map(([key, clientConfig]) => ({cId: key, clientConfig: clientConfig}))
        .forEach(pair => {
            if (pair.clientConfig.ws.readyState === WebSocket.CLOSED) {
              closedEmployeesOnlyClients.push(pair.cId);
            }
        }
      );

  closedEmployeesOnlyClients.forEach(
    (clientId) => employeesOnlyMap.delete(clientId)
  );

  const closedTournamentClients = [];
  [...tournamentMap]
        .map(([key, clientConfig]) => ({cId: key, clientConfig: clientConfig}))
        .forEach(pair => {
            if (pair.clientConfig.ws.readyState === WebSocket.CLOSED) {
              closedTournamentClients.push(pair.cId);
            }
        }
      );

      closedTournamentClients.forEach(
    (clientId) => tournamentMap.delete(clientId)
  );

  const closedTournamentsOfClub = [];
  [...tournamentsOfClubMap]
        .map(([key, clientConfig]) => ({cId: key, clientConfig: clientConfig}))
        .forEach(pair => {
            if (pair.clientConfig.ws.readyState === WebSocket.CLOSED) {
              closedTournamentsOfClub.push(pair.cId);
            }
        }
      );

      closedTournamentsOfClub.forEach(
    (clientId) => tournamentsOfClubMap.delete(clientId)
  );
};

app.get('/', (req, res) => {
    res.send('Hello World!');
});
