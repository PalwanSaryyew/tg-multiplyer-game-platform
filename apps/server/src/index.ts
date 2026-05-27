import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
const httpServer = createServer(app);

const io = new Server(httpServer, {
   cors: { origin: "*", methods: ["GET", "POST"] },
});

let waitingPlayer: any = null;
let checkersWaitingPlayer: any = null;
let c4Waiting: any = null;
const activeRooms = new Map();
const hubLobbies = new Map();

// --- YARDIMCI FONKSİYONLAR ---
function createInitialCheckersBoard() {
   const board = Array(64).fill(0);
   for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
         if ((row + col) % 2 === 1) {
            if (row < 3) board[row * 8 + col] = 2;
            if (row > 4) board[row * 8 + col] = 1;
         }
      }
   }
   return board;
}

function hasCapturesForPiece(
   board: number[],
   idx: number,
   isRed: boolean,
): boolean {
   const piece = board[idx];
   if (piece === 0) return false;
   const isKing = piece === 3 || piece === 4;
   const row = Math.floor(idx / 8);
   const col = idx % 8;
   const dirs = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
   ];

   for (const [dr, dc] of dirs) {
      let r = row + dr;
      let c = col + dc;
      let foundOpponent = false;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
         const targetIdx = r * 8 + c;
         const targetPiece = board[targetIdx];
         if (targetPiece !== 0) {
            const isOpponent = isRed
               ? targetPiece === 2 || targetPiece === 4
               : targetPiece === 1 || targetPiece === 3;
            if (isOpponent) {
               if (foundOpponent) break;
               foundOpponent = true;
            } else {
               break;
            }
         } else if (foundOpponent) {
            return true;
         } else if (!isKing) {
            break;
         }
         r += dr;
         c += dc;
      }
   }
   return false;
}

function checkForcedCaptures(board: number[], isRed: boolean): boolean {
   for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (isRed && (p === 1 || p === 3) && hasCapturesForPiece(board, i, isRed))
         return true;
      if (
         !isRed &&
         (p === 2 || p === 4) &&
         hasCapturesForPiece(board, i, isRed)
      )
         return true;
   }
   return false;
}

function createC4Board() {
   return Array(42).fill(0);
}

function checkC4Winner(board: number[]) {
   const rows = 6;
   const cols = 7;
   for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 3; c++) {
         const i = r * cols + c;
         if (
            board[i] !== 0 &&
            board[i] === board[i + 1] &&
            board[i] === board[i + 2] &&
            board[i] === board[i + 3]
         )
            return board[i];
      }
   }
   for (let r = 0; r < rows - 3; r++) {
      for (let c = 0; r * cols + c < board.length && c < cols; c++) {
         const i = r * cols + c;
         if (
            board[i] !== 0 &&
            board[i] === board[i + cols] &&
            board[i] === board[i + cols * 2] &&
            board[i] === board[i + cols * 3]
         )
            return board[i];
      }
   }
   for (let r = 0; r < rows - 3; r++) {
      for (let c = 0; c < cols - 3; c++) {
         const i = r * cols + c;
         if (
            board[i] !== 0 &&
            board[i] === board[i + cols + 1] &&
            board[i] === board[i + (cols + 1) * 2] &&
            board[i] === board[i + (cols + 1) * 3]
         )
            return board[i];
      }
   }
   for (let r = 0; r < rows - 3; r++) {
      for (let c = 3; c < cols; c++) {
         const i = r * cols + c;
         if (
            board[i] !== 0 &&
            board[i] === board[i + cols - 1] &&
            board[i] === board[i + (cols - 1) * 2] &&
            board[i] === board[i + (cols - 1) * 3]
         )
            return board[i];
      }
   }
   return board.includes(0) ? null : "DRAW";
}

io.on("connection", (socket) => {
   console.log(`🟢 Yeni oyuncu: ${socket.id}`);

   socket.on("register_player", async ({ telegramId, username }) => {
      if (!telegramId) return;
      try {
         const player = await prisma.player.upsert({
            where: { telegramId: String(telegramId) },
            update: { username: username },
            create: { telegramId: String(telegramId), username: username },
         });
         socket.data.dbId = player.id;
         socket.data.telegramId = player.telegramId;
         socket.data.username = player.username;
         socket.emit("player_registered", player);
      } catch (error) {}
   });

   socket.on("get_leaderboard", async () => {
      try {
         const topPlayers = await prisma.player.findMany({
            orderBy: { wins: "desc" },
            take: 10,
            select: { username: true, wins: true, losses: true },
         });
         socket.emit("leaderboard_data", topPlayers);
      } catch (error) {}
   });

   // ==========================================
   // --- ANA MERKEZ LOBİSİ ---
   // ==========================================
   socket.on("create_hub_lobby", (data) => {
      const lobbyId = `lobby_${Math.random().toString(36).substring(7)}`;
      const username = socket.data.username || data?.username || "Misafir";
      socket.join(lobbyId);
      hubLobbies.set(lobbyId, {
         host: socket.id,
         players: [{ socketId: socket.id, username }],
      });
      socket.emit("hub_lobby_updated", {
         lobbyId,
         players: hubLobbies.get(lobbyId).players,
      });
   });

   socket.on("join_hub_lobby", (data) => {
      const lobbyId = data?.lobbyId;
      const lobby = hubLobbies.get(lobbyId);
      if (lobby && lobby.players.length === 1) {
         const username = socket.data.username || data?.username || "Misafir";
         socket.join(lobbyId);
         lobby.players.push({ socketId: socket.id, username });
         io.to(lobbyId).emit("hub_lobby_updated", {
            lobbyId,
            players: lobby.players,
         });
      } else {
         socket.emit("room_error", { message: "Lobi bulunamadı veya dolu." });
      }
   });

   socket.on("leave_hub_lobby", ({ lobbyId }) => {
      socket.leave(lobbyId);
      hubLobbies.delete(lobbyId);
      socket.to(lobbyId).emit("hub_lobby_closed");
   });

   socket.on("launch_hub_game", ({ lobbyId, gameType }) => {
      const lobby = hubLobbies.get(lobbyId);
      if (!lobby || lobby.host !== socket.id) return;
      let roomId = "";
      let gamePath = "";

      if (gameType === "RPS") {
         roomId = `pvp_${Math.random().toString(36).substring(7)}`;
         gamePath = "/rps";
         activeRooms.set(roomId, {
            isPrivate: true,
            players: [],
            playerDbIds: [],
            playerNames: [],
            moves: {},
         });
      } else if (gameType === "CHECKERS") {
         roomId = `cpvp_${Math.random().toString(36).substring(7)}`;
         gamePath = "/checkers";
         activeRooms.set(roomId, {
            gameType: "CHECKERS",
            isPrivate: true,
            players: [],
            playerDbIds: [],
            playerNames: [],
            board: createInitialCheckersBoard(),
            turn: null,
            multiJumpIndex: null,
         });
      } else if (gameType === "CONNECT4") {
         roomId = `c4pvp_${Math.random().toString(36).substring(7)}`;
         gamePath = "/connect4";
         activeRooms.set(roomId, {
            gameType: "CONNECT4",
            isPrivate: true,
            players: [],
            playerDbIds: [],
            playerNames: [],
            board: createC4Board(),
            turn: null,
         });
      }

      io.to(lobbyId).emit("hub_game_launched", { gamePath, roomId });
   });

   // ==========================================
   // --- OYUN İÇİ ODALAR (Korumalar Eklendi) ---
   // ==========================================

   socket.on("find_match", (data) => {
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      if (waitingPlayer && waitingPlayer.socketId !== socket.id) {
         const roomId = `room_${Math.random().toString(36).substring(7)}`;
         socket.join(roomId);
         io.sockets.sockets.get(waitingPlayer.socketId)?.join(roomId);
         activeRooms.set(roomId, {
            isPrivate: false,
            players: [socket.id, waitingPlayer.socketId],
            playerDbIds: [dbId, waitingPlayer.dbId],
            moves: {},
         });
         io.to(roomId).emit("match_found", {
            roomId,
            players: [
               { socketId: socket.id, username },
               {
                  socketId: waitingPlayer.socketId,
                  username: waitingPlayer.username,
               },
            ],
         });
         waitingPlayer = null;
      } else {
         waitingPlayer = { socketId: socket.id, dbId, username };
         socket.emit("waiting_in_queue");
      }
   });

   socket.on("create_private_room", (data) => {
      const roomId = `pvp_${Math.random().toString(36).substring(7)}`;
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      socket.join(roomId);
      activeRooms.set(roomId, {
         isPrivate: true,
         players: [socket.id],
         playerDbIds: [dbId],
         playerNames: [username],
         moves: {},
      });
      socket.emit("private_room_created", { roomId });
   });

   socket.on("join_private_room", (data) => {
      const roomId = data?.roomId;
      const room = activeRooms.get(roomId);
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      if (room && room.isPrivate) {
         // FIX: Çift istek koruması
         if (room.players.includes(socket.id)) {
            if (room.players.length === 2) {
               socket.emit("match_found", {
                  roomId,
                  players: [
                     {
                        socketId: room.players[0],
                        username: room.playerNames[0],
                     },
                     {
                        socketId: room.players[1],
                        username: room.playerNames[1],
                     },
                  ],
               });
            }
            return;
         }
         if (room.players.length < 2) {
            socket.join(roomId);
            room.players.push(socket.id);
            room.playerDbIds.push(dbId);
            room.playerNames.push(username);
            if (room.players.length === 2) {
               io.to(roomId).emit("match_found", {
                  roomId,
                  players: [
                     {
                        socketId: room.players[0],
                        username: room.playerNames[0],
                     },
                     {
                        socketId: room.players[1],
                        username: room.playerNames[1],
                     },
                  ],
               });
            }
         } else {
            socket.emit("room_error", { message: "Oda bulunamadı veya dolu." });
         }
      } else {
         socket.emit("room_error", { message: "Oda bulunamadı veya dolu." });
      }
   });

   socket.on("play_move", async ({ roomId, move }) => {
      const room = activeRooms.get(roomId);
      if (!room) return;
      room.moves[socket.id] = move;
      socket.to(roomId).emit("opponent_played");
      const [p1, p2] = room.players;
      const [dbId1, dbId2] = room.playerDbIds;
      if (room.moves[p1] && room.moves[p2]) {
         const move1 = room.moves[p1];
         const move2 = room.moves[p2];
         let winner = null;
         if (move1 === move2) {
            winner = "DRAW";
            await prisma.player
               .updateMany({
                  where: { id: { in: [dbId1, dbId2] } },
                  data: { draws: { increment: 1 } },
               })
               .catch(() => {});
         } else if (
            (move1 === "ROCK" && move2 === "SCISSORS") ||
            (move1 === "PAPER" && move2 === "ROCK") ||
            (move1 === "SCISSORS" && move2 === "PAPER")
         ) {
            winner = p1;
            await prisma.player
               .update({
                  where: { id: dbId1 },
                  data: { wins: { increment: 1 } },
               })
               .catch(() => {});
            await prisma.player
               .update({
                  where: { id: dbId2 },
                  data: { losses: { increment: 1 } },
               })
               .catch(() => {});
         } else {
            winner = p2;
            await prisma.player
               .update({
                  where: { id: dbId2 },
                  data: { wins: { increment: 1 } },
               })
               .catch(() => {});
            await prisma.player
               .update({
                  where: { id: dbId1 },
                  data: { losses: { increment: 1 } },
               })
               .catch(() => {});
         }
         io.to(roomId).emit("game_result", { moves: room.moves, winner });
         room.moves = {};
      }
   });

   // CHECKERS
   socket.on("checkers_find_match", (data) => {
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      if (
         checkersWaitingPlayer &&
         checkersWaitingPlayer.socketId !== socket.id
      ) {
         const roomId = `checkers_${Math.random().toString(36).substring(7)}`;
         socket.join(roomId);
         io.sockets.sockets.get(checkersWaitingPlayer.socketId)?.join(roomId);
         activeRooms.set(roomId, {
            gameType: "CHECKERS",
            isPrivate: false,
            players: [checkersWaitingPlayer.socketId, socket.id],
            playerDbIds: [checkersWaitingPlayer.dbId, dbId],
            board: createInitialCheckersBoard(),
            turn: checkersWaitingPlayer.socketId,
            multiJumpIndex: null,
         });
         io.to(roomId).emit("checkers_match_found", {
            roomId,
            board: activeRooms.get(roomId).board,
            turn: activeRooms.get(roomId).turn,
            players: [
               {
                  socketId: checkersWaitingPlayer.socketId,
                  username: checkersWaitingPlayer.username,
                  color: "RED",
               },
               { socketId: socket.id, username, color: "WHITE" },
            ],
         });
         checkersWaitingPlayer = null;
      } else {
         checkersWaitingPlayer = { socketId: socket.id, dbId, username };
         socket.emit("checkers_waiting_in_queue");
      }
   });

   socket.on("checkers_create_private_room", (data) => {
      const roomId = `cpvp_${Math.random().toString(36).substring(7)}`;
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      socket.join(roomId);
      activeRooms.set(roomId, {
         gameType: "CHECKERS",
         isPrivate: true,
         players: [socket.id],
         playerDbIds: [dbId],
         playerNames: [username],
         board: createInitialCheckersBoard(),
         turn: null,
         multiJumpIndex: null,
      });
      socket.emit("checkers_private_room_created", { roomId });
   });

   socket.on("checkers_join_private_room", (data) => {
      const roomId = data?.roomId;
      const room = activeRooms.get(roomId);
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      if (room && room.gameType === "CHECKERS" && room.isPrivate) {
         // FIX: Çift istek koruması
         if (room.players.includes(socket.id)) {
            if (room.players.length === 2) {
               socket.emit("checkers_match_found", {
                  roomId: roomId,
                  board: room.board,
                  turn: room.turn,
                  players: [
                     {
                        socketId: room.players[0],
                        username: room.playerNames[0],
                        color: "RED",
                     },
                     {
                        socketId: room.players[1],
                        username: room.playerNames[1],
                        color: "WHITE",
                     },
                  ],
               });
            }
            return;
         }
         if (room.players.length < 2) {
            socket.join(roomId);
            room.players.push(socket.id);
            room.playerDbIds.push(dbId);
            room.playerNames.push(username);
            if (room.players.length === 2) {
               room.turn = room.players[0];
               io.to(roomId).emit("checkers_match_found", {
                  roomId: roomId,
                  board: room.board,
                  turn: room.turn,
                  players: [
                     {
                        socketId: room.players[0],
                        username: room.playerNames[0],
                        color: "RED",
                     },
                     {
                        socketId: room.players[1],
                        username: room.playerNames[1],
                        color: "WHITE",
                     },
                  ],
               });
            }
         } else {
            socket.emit("checkers_room_error", {
               message: "Düello odası bulunamadı veya doldu.",
            });
         }
      } else {
         socket.emit("checkers_room_error", {
            message: "Düello odası bulunamadı veya doldu.",
         });
      }
   });

   socket.on("checkers_make_move", async ({ roomId, fromIndex, toIndex }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.turn !== socket.id) return;
      const board = room.board;
      const piece = board[fromIndex];
      const target = board[toIndex];
      const isP1Red = socket.id === room.players[0];
      if (isP1Red && piece !== 1 && piece !== 3) return;
      if (!isP1Red && piece !== 2 && piece !== 4) return;
      if (target !== 0) return;
      if (room.multiJumpIndex !== null && room.multiJumpIndex !== fromIndex) {
         socket.emit("checkers_invalid_move", { reason: "MUST_CONTINUE_JUMP" });
         return;
      }

      const fromRow = Math.floor(fromIndex / 8);
      const fromCol = fromIndex % 8;
      const toRow = Math.floor(toIndex / 8);
      const toCol = toIndex % 8;
      const isKing = piece === 3 || piece === 4;
      if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) {
         socket.emit("checkers_invalid_move");
         return;
      }
      const rowStep = Math.sign(toRow - fromRow);
      const colStep = Math.sign(toCol - fromCol);
      let r = fromRow + rowStep;
      let c = fromCol + colStep;
      let jumpedIndex = -1;
      let opponentCount = 0;
      let isValidMove = true;

      while (r !== toRow || c !== toCol) {
         const idx = r * 8 + c;
         const p = board[idx];
         if (p !== 0) {
            const isOpponent = isP1Red
               ? p === 2 || p === 4
               : p === 1 || p === 3;
            if (isOpponent) {
               opponentCount++;
               jumpedIndex = idx;
            } else {
               isValidMove = false;
               break;
            }
         }
         r += rowStep;
         c += colStep;
      }
      if (opponentCount > 1) isValidMove = false;
      if (!isKing) {
         if (opponentCount === 0 && Math.abs(toRow - fromRow) !== 1)
            isValidMove = false;
         if (opponentCount === 1 && Math.abs(toRow - fromRow) !== 2)
            isValidMove = false;
         if (opponentCount === 0) {
            if (isP1Red && toRow > fromRow) isValidMove = false;
            if (!isP1Red && toRow < fromRow) isValidMove = false;
         }
      }
      if (room.multiJumpIndex !== null && opponentCount === 0) {
         socket.emit("checkers_invalid_move", { reason: "MUST_CONTINUE_JUMP" });
         return;
      }
      const isCaptureMove = opponentCount === 1;
      if (isValidMove && !isCaptureMove && room.multiJumpIndex === null) {
         if (checkForcedCaptures(board, isP1Red)) {
            socket.emit("checkers_invalid_move", { reason: "MUST_CAPTURE" });
            return;
         }
      }
      if (!isValidMove) {
         socket.emit("checkers_invalid_move");
         return;
      }

      board[toIndex] = piece;
      board[fromIndex] = 0;
      if (jumpedIndex !== -1) board[jumpedIndex] = 0;
      let turnEnds = true;
      let promoted = false;
      if (isP1Red && toRow === 0 && piece === 1) {
         board[toIndex] = 3;
         promoted = true;
      }
      if (!isP1Red && toRow === 7 && piece === 2) {
         board[toIndex] = 4;
         promoted = true;
      }
      if (jumpedIndex !== -1 && !promoted) {
         const canJumpAgain = hasCapturesForPiece(board, toIndex, isP1Red);
         if (canJumpAgain) {
            turnEnds = false;
            room.multiJumpIndex = toIndex;
         }
      }
      if (turnEnds) {
         room.turn = isP1Red ? room.players[1] : room.players[0];
         room.multiJumpIndex = null;
      }

      const hasRed = board.includes(1) || board.includes(3);
      const hasWhite = board.includes(2) || board.includes(4);
      if (!hasRed || !hasWhite) {
         const winnerId = hasRed ? room.players[0] : room.players[1];
         const loserId = hasRed ? room.players[1] : room.players[0];
         const winnerDb = room.playerDbIds[room.players.indexOf(winnerId)];
         const loserDb = room.playerDbIds[room.players.indexOf(loserId)];
         await prisma.player
            .update({
               where: { id: winnerDb },
               data: { wins: { increment: 1 } },
            })
            .catch(() => {});
         await prisma.player
            .update({
               where: { id: loserDb },
               data: { losses: { increment: 1 } },
            })
            .catch(() => {});
         io.to(roomId).emit("checkers_game_over", { winner: winnerId, board });
         activeRooms.delete(roomId);
      } else {
         io.to(roomId).emit("checkers_board_updated", {
            board,
            turn: room.turn,
            multiJumpIndex: room.multiJumpIndex,
         });
      }
   });

   // CONNECT 4
   socket.on("c4_find_match", (data) => {
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      if (c4Waiting && c4Waiting.socketId !== socket.id) {
         const roomId = `c4_${Math.random().toString(36).substring(7)}`;
         socket.join(roomId);
         io.sockets.sockets.get(c4Waiting.socketId)?.join(roomId);
         activeRooms.set(roomId, {
            gameType: "CONNECT4",
            isPrivate: false,
            players: [c4Waiting.socketId, socket.id],
            playerDbIds: [c4Waiting.dbId, dbId],
            board: createC4Board(),
            turn: c4Waiting.socketId,
            playerNames: [c4Waiting.username, username],
         });
         io.to(roomId).emit("c4_match_found", {
            roomId,
            board: activeRooms.get(roomId).board,
            turn: c4Waiting.socketId,
            players: [
               {
                  id: c4Waiting.socketId,
                  name: c4Waiting.username,
                  color: "YELLOW",
               },
               { id: socket.id, name: username, color: "RED" },
            ],
         });
         c4Waiting = null;
      } else {
         c4Waiting = { socketId: socket.id, dbId, username };
         socket.emit("c4_waiting");
      }
   });

   socket.on("c4_create_private_room", (data) => {
      const roomId = `c4pvp_${Math.random().toString(36).substring(7)}`;
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      socket.join(roomId);
      activeRooms.set(roomId, {
         gameType: "CONNECT4",
         isPrivate: true,
         players: [socket.id],
         playerDbIds: [dbId],
         playerNames: [username],
         board: createC4Board(),
         turn: null,
      });
      socket.emit("c4_private_room_created", { roomId });
   });

   socket.on("c4_join_private_room", (data) => {
      const roomId = data?.roomId;
      const room = activeRooms.get(roomId);
      const username = socket.data.username || data?.username || "Misafir";
      const dbId = socket.data.dbId || socket.id;
      if (room && room.gameType === "CONNECT4" && room.isPrivate) {
         // FIX: Çift istek koruması
         if (room.players.includes(socket.id)) {
            if (room.players.length === 2) {
               socket.emit("c4_match_found", {
                  roomId,
                  board: room.board,
                  turn: room.turn,
                  players: [
                     {
                        id: room.players[0],
                        name: room.playerNames[0],
                        color: "YELLOW",
                     },
                     {
                        id: room.players[1],
                        name: room.playerNames[1],
                        color: "RED",
                     },
                  ],
               });
            }
            return;
         }
         if (room.players.length < 2) {
            socket.join(roomId);
            room.players.push(socket.id);
            room.playerDbIds.push(dbId);
            room.playerNames.push(username);
            if (room.players.length === 2) {
               room.turn = room.players[0];
               io.to(roomId).emit("c4_match_found", {
                  roomId,
                  board: room.board,
                  turn: room.turn,
                  players: [
                     {
                        id: room.players[0],
                        name: room.playerNames[0],
                        color: "YELLOW",
                     },
                     {
                        id: room.players[1],
                        name: room.playerNames[1],
                        color: "RED",
                     },
                  ],
               });
            }
         } else {
            socket.emit("room_error", { message: "Oda bulunamadı veya dolu." });
         }
      } else {
         socket.emit("room_error", { message: "Oda bulunamadı veya dolu." });
      }
   });

   socket.on("disconnect", () => {
      if (waitingPlayer && waitingPlayer.socketId === socket.id)
         waitingPlayer = null;
      if (checkersWaitingPlayer && checkersWaitingPlayer.socketId === socket.id)
         checkersWaitingPlayer = null;
      if (c4Waiting && c4Waiting.socketId === socket.id) c4Waiting = null;
   });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda!`));
