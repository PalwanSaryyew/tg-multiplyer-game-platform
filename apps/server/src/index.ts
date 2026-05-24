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
const activeRooms = new Map();
let checkersWaitingPlayer: any = null;

function createInitialCheckersBoard() {
   const board = Array(64).fill(0);
   for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
         if ((row + col) % 2 === 1) {
            if (row < 3) board[row * 8 + col] = 2; // Beyaz
            if (row > 4) board[row * 8 + col] = 1; // Kırmızı
         }
      }
   }
   return board;
}

// YENİ: Belli bir taşın yiyebileceği rakip var mı kontrol eder
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
               if (foundOpponent) break; // İki taş arka arkaya gelmiş
               foundOpponent = true;
            } else {
               break; // Kendi taşı yolu kapatmış
            }
         } else if (foundOpponent) {
            return true; // Rakip taşı geçmiş ve arkası boş, KESİN YİYEBİLİR!
         } else if (!isKing) {
            break; // Kral değilse boş kareleri uçarak geçemez
         }
         r += dr;
         c += dc;
      }
   }
   return false;
}

// YENİ VE DÜZELTİLMİŞ: Tahtada herhangi bir taş için zorunlu yeme var mı?
function checkForcedCaptures(board: number[], isRed: boolean): boolean {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    // HATA BURADAYDI: Beyaz taşlar için '!isRed' gönderince kendi taşlarını rakip sanıyordu!
    // Artık her ikisi için de doğrudan 'isRed' durumunu gönderiyoruz.
    if (isRed && (p === 1 || p === 3) && hasCapturesForPiece(board, i, isRed)) return true;
    if (!isRed && (p === 2 || p === 4) && hasCapturesForPiece(board, i, isRed)) return true;
  }
  return false;
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

   // T.K.M KODLARI
   socket.on("find_match", () => {
      /* ... (TKM KODLARI KORUNDU) ... */
   });
   socket.on("create_private_room", () => {
      /* ... (TKM KODLARI KORUNDU) ... */
   });
   socket.on("join_private_room", ({ roomId }) => {
      /* ... (TKM KODLARI KORUNDU) ... */
   });
   socket.on("play_move", async ({ roomId, move }) => {
      /* ... (TKM KODLARI KORUNDU) ... */
   });

   // --- DAMA EŞLEŞTİRME VE MOTORU ---
   socket.on("checkers_find_match", () => {
      const username = socket.data.username || "Misafir";
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
            players: [checkersWaitingPlayer.socketId, socket.id],
            playerDbIds: [checkersWaitingPlayer.dbId, dbId],
            board: createInitialCheckersBoard(),
            turn: checkersWaitingPlayer.socketId,
            multiJumpIndex: null, // YENİ: Seri yeme takibi
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

      // YENİ: Seri yeme (multi-jump) devam ediyorsa, SADECE o taşı oynayabilir.
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

      // YENİ: Eğer seri yeme sırasındaysa, boş hamle yapamaz. Kesinlikle yemelidir.
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

      // HAMLEYİ UYGULA
      board[toIndex] = piece;
      board[fromIndex] = 0;
      if (jumpedIndex !== -1) board[jumpedIndex] = 0;

      let turnEnds = true;
      let promoted = false;

      // KRAL (DAMA) OLMA
      if (isP1Red && toRow === 0 && piece === 1) {
         board[toIndex] = 3;
         promoted = true;
      }
      if (!isP1Red && toRow === 7 && piece === 2) {
         board[toIndex] = 4;
         promoted = true;
      }

      // YENİ: Seri Yeme (Multi-Jump) Kontrolü
      if (jumpedIndex !== -1 && !promoted) {
         const canJumpAgain = hasCapturesForPiece(board, toIndex, isP1Red);
         if (canJumpAgain) {
            turnEnds = false; // Sıra bitmedi!
            room.multiJumpIndex = toIndex; // Taşı hafızaya kazı
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
         // YENİ: Seri yeme durumu varsa bunu frontend'e bildiriyoruz
         io.to(roomId).emit("checkers_board_updated", {
            board,
            turn: room.turn,
            multiJumpIndex: room.multiJumpIndex,
         });
      }
   });

   socket.on("disconnect", () => {
      if (waitingPlayer && waitingPlayer.socketId === socket.id)
         waitingPlayer = null;
      if (checkersWaitingPlayer && checkersWaitingPlayer.socketId === socket.id)
         checkersWaitingPlayer = null;
   });
});

const PORT = process.env.PORT;
httpServer.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda!`));
