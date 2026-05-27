"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSocket } from "../../providers/SocketProvider";
import { useLanguage } from "../../providers/LanguageProvider"; // YENİ

export default function CheckersGame() {
   const { t } = useLanguage(); // YENİ
   const { socket, isConnected } = useSocket();
   const [isSearching, setIsSearching] = useState(false);
   const [roomData, setRoomData] = useState<any>(null);

   const [board, setBoard] = useState<number[]>([]);
   const [turn, setTurn] = useState<string>("");
   const [myColor, setMyColor] = useState<"RED" | "WHITE" | null>(null);
   const [selectedCell, setSelectedCell] = useState<number | null>(null);
   const [winner, setWinner] = useState<string | null>(null);
   const [moveError, setMoveError] = useState<string | null>(null);

   const [inviteCode, setInviteCode] = useState<string | null>(null);
   const [showJoinInput, setShowJoinInput] = useState(false);
   const [joinCodeInput, setJoinCodeInput] = useState("");

   useEffect(() => {
      if (!socket) return;
      const checkLinks = async () => {
         const urlParams = new URLSearchParams(window.location.search);
         const roomQuery = urlParams.get("room");

         if (roomQuery) {
            socket.emit("checkers_join_private_room", { roomId: roomQuery });
         } else if (typeof window !== "undefined") {
            const WebApp = (await import("@twa-dev/sdk")).default;
            const startParam = WebApp.initDataUnsafe?.start_param;
            if (startParam && startParam.startsWith("cpvp_")) {
               socket.emit("checkers_join_private_room", {
                  roomId: startParam,
               });
            }
         }
      };
      checkLinks();

      socket.on("checkers_waiting_in_queue", () => setIsSearching(true));
      socket.on("checkers_private_room_created", ({ roomId }) =>
         setInviteCode(roomId),
      );

      socket.on("checkers_room_error", (data) => {
         setMoveError(data.message);
         setTimeout(() => setMoveError(null), 3000);
      });

      socket.on("checkers_match_found", (data) => {
         setIsSearching(false);
         setInviteCode(null);
         setShowJoinInput(false);
         setRoomData(data);
         setBoard(data.board);
         setTurn(data.turn);
         setWinner(null);
         setSelectedCell(null);
         setMoveError(null);
         const me = data.players.find((p: any) => p.socketId === socket.id);
         if (me) setMyColor(me.color);
      });

      socket.on("checkers_board_updated", (data) => {
         setBoard(data.board);
         setTurn(data.turn);
         setMoveError(null);
         if (data.multiJumpIndex !== undefined && data.multiJumpIndex !== null)
            setSelectedCell(data.multiJumpIndex);
         else setSelectedCell(null);
      });

      socket.on("checkers_game_over", (data) => {
         setBoard(data.board);
         setWinner(data.winner);
         setSelectedCell(null);
      });

      socket.on("checkers_invalid_move", (data) => {
         // Sunucudan gelen hatayı dile göre çeviriyoruz
         if (data?.reason === "MUST_CAPTURE") {
            setSelectedCell(null);
            setMoveError(t.checkers.mustCapture);
         } else if (data?.reason === "MUST_CONTINUE_JUMP")
            setMoveError(t.checkers.mustContinueJump);
         else setSelectedCell(null);
         setTimeout(() => setMoveError(null), 3000);
      });

      return () => {
         socket.off("checkers_waiting_in_queue");
         socket.off("checkers_private_room_created");
         socket.off("checkers_room_error");
         socket.off("checkers_match_found");
         socket.off("checkers_board_updated");
         socket.off("checkers_game_over");
         socket.off("checkers_invalid_move");
      };
   }, [socket, t]);

   const handleFindMatch = () => socket?.emit("checkers_find_match");
   const handleCreatePrivateRoom = () =>
      socket?.emit("checkers_create_private_room");
   const handleJoinPrivateRoom = () => {
      if (joinCodeInput.trim())
         socket?.emit("checkers_join_private_room", {
            roomId: joinCodeInput.trim(),
         });
   };

   const shareToTelegram = async () => {
      if (!inviteCode) return;
      const shareUrl = `https://t.me/${process.env.NEXT_PUBLIC_TG_BOT}/${process.env.NEXT_PUBLIC_TG_APP}?startapp=${inviteCode}`;
      const text = t.checkers.shareText;
      if (typeof window !== "undefined") {
         const WebApp = (await import("@twa-dev/sdk")).default;
         WebApp.openTelegramLink(
            `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
         );
      }
   };

   const handleCellClick = (index: number) => {
      if (!socket || !roomData || winner || turn !== socket.id) return;
      if (
         roomData.multiJumpIndex !== null &&
         roomData.multiJumpIndex !== undefined
      ) {
         if (board[index] !== 0 && index !== roomData.multiJumpIndex) {
            setMoveError(t.checkers.mustContinueJump);
            setTimeout(() => setMoveError(null), 3000);
            return;
         }
      }
      const cellValue = board[index];
      if (
         (myColor === "RED" && (cellValue === 1 || cellValue === 3)) ||
         (myColor === "WHITE" && (cellValue === 2 || cellValue === 4))
      ) {
         setSelectedCell(index);
         setMoveError(null);
      } else if (selectedCell !== null && cellValue === 0) {
         socket.emit("checkers_make_move", {
            roomId: roomData.roomId,
            fromIndex: selectedCell,
            toIndex: index,
         });
      }
   };

   const boardIndices = Array.from({ length: 64 }, (_, i) => i);
   const displayIndices =
      myColor === "WHITE" ? [...boardIndices].reverse() : boardIndices;

   return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white font-sans overflow-hidden">
         <div className="absolute top-4 left-4">
            <Link
               href="/"
               className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors"
            >
               {t.common.mainMenu}
            </Link>
         </div>
         <AnimatePresence>
            {moveError && (
               <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 10 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="absolute top-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg font-bold z-50 text-center text-sm max-w-[90%]"
               >
                  ⚠️ {moveError}
               </motion.div>
            )}
         </AnimatePresence>

         <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 p-6 rounded-xl shadow-lg border border-zinc-800 w-full max-w-sm relative mt-8"
         >
            <h2 className="text-xl font-bold mb-4 text-center border-b border-zinc-800 pb-4">
               {t.games.checkersTitle}
            </h2>

            <AnimatePresence mode="wait">
               {!roomData ? (
                  !inviteCode ? (
                     <motion.div
                        key="lobby"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex flex-col gap-3"
                     >
                        <button
                           onClick={handleFindMatch}
                           disabled={isSearching || !isConnected}
                           className={`w-full py-3 rounded-lg font-bold transition-colors ${isSearching ? "bg-blue-600 animate-pulse text-white" : !isConnected ? "bg-zinc-700 text-zinc-500" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
                        >
                           {isSearching
                              ? t.common.searching
                              : t.common.randomMatch}
                        </button>
                        {!isSearching && (
                           <div className="flex gap-2 w-full">
                              <button
                                 onClick={handleCreatePrivateRoom}
                                 disabled={!isConnected}
                                 className="flex-1 py-3 bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-bold transition-colors text-sm"
                              >
                                 {t.common.createDuel}
                              </button>
                              <button
                                 onClick={() =>
                                    setShowJoinInput(!showJoinInput)
                                 }
                                 disabled={!isConnected}
                                 className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg font-bold transition-colors text-sm"
                              >
                                 {t.common.join}
                              </button>
                           </div>
                        )}
                        {showJoinInput && !isSearching && (
                           <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="flex gap-2 mt-2"
                           >
                              <input
                                 type="text"
                                 placeholder={t.checkers.roomCodePlaceholder}
                                 value={joinCodeInput}
                                 onChange={(e) =>
                                    setJoinCodeInput(e.target.value)
                                 }
                                 className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                              />
                              <button
                                 onClick={handleJoinPrivateRoom}
                                 className="bg-purple-600 hover:bg-purple-500 px-4 rounded-lg font-bold text-sm"
                              >
                                 {t.common.go}
                              </button>
                           </motion.div>
                        )}
                     </motion.div>
                  ) : (
                     <motion.div
                        key="invite"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center bg-zinc-800 p-4 rounded-lg border border-purple-500/50"
                     >
                        <h3 className="text-purple-400 font-bold mb-2">
                           {t.common.roomReady}
                        </h3>
                        <p className="text-xs text-zinc-400 mb-4">
                           {t.common.inviteFriendDesc}
                        </p>
                        <div className="bg-zinc-950 p-3 rounded-lg mb-4 select-all font-mono text-xs border border-zinc-700">
                           {inviteCode}
                        </div>
                        <div className="flex gap-2">
                           <button
                              onClick={shareToTelegram}
                              className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold text-xs"
                           >
                              {t.common.shareTelegram}
                           </button>
                           <button
                              onClick={() => setInviteCode(null)}
                              className="px-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold text-xs"
                           >
                              {t.common.cancel}
                           </button>
                        </div>
                     </motion.div>
                  )
               ) : (
                  <motion.div
                     key="game"
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     className="flex flex-col items-center"
                  >
                     <div className="w-full flex justify-between text-xs text-zinc-400 mb-4 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                        <span
                           className={
                              myColor === "RED" ? "text-red-400 font-bold" : ""
                           }
                        >
                           🔴 {roomData.players[0].username}
                        </span>
                        <span className="text-zinc-600">{t.common.vs}</span>
                        <span
                           className={
                              myColor === "WHITE"
                                 ? "text-zinc-200 font-bold"
                                 : ""
                           }
                        >
                           ⚪ {roomData.players[1].username}
                        </span>
                     </div>
                     <h3 className="text-sm font-semibold mb-4 text-zinc-300">
                        {winner
                           ? winner === socket?.id
                              ? t.common.youWin
                              : t.common.youLose
                           : turn === socket?.id
                             ? t.common.yourTurn
                             : t.common.opponentsTurn}
                     </h3>
                     <div className="grid grid-cols-8 gap-0 border-2 border-zinc-700 rounded-lg overflow-hidden w-full aspect-square bg-zinc-950 shadow-2xl relative">
                        {displayIndices.map((actualIndex) => {
                           const cell = board[actualIndex];
                           const row = Math.floor(actualIndex / 8);
                           const col = actualIndex % 8;
                           const isDarkSquare = (row + col) % 2 === 1;
                           return (
                              <div
                                 key={actualIndex}
                                 onClick={() =>
                                    isDarkSquare && handleCellClick(actualIndex)
                                 }
                                 className={`w-full h-full flex items-center justify-center relative aspect-square transition-all ${isDarkSquare ? "bg-zinc-800 cursor-pointer hover:bg-zinc-700/50" : "bg-zinc-200"} ${selectedCell === actualIndex ? "ring-4 ring-purple-500 ring-inset bg-zinc-700" : ""}`}
                              >
                                 {(cell === 1 || cell === 3) && (
                                    <motion.div
                                       layoutId={`piece-${actualIndex}`}
                                       className="w-4/5 h-4/5 rounded-full bg-red-600 shadow-md border-2 border-red-800 flex items-center justify-center z-10"
                                    >
                                       {cell === 3 && (
                                          <span className="text-xs sm:text-sm drop-shadow-md">
                                             👑
                                          </span>
                                       )}
                                    </motion.div>
                                 )}
                                 {(cell === 2 || cell === 4) && (
                                    <motion.div
                                       layoutId={`piece-${actualIndex}`}
                                       className="w-4/5 h-4/5 rounded-full bg-zinc-300 shadow-md border-2 border-zinc-400 flex items-center justify-center z-10"
                                    >
                                       {cell === 4 && (
                                          <span className="text-xs sm:text-sm drop-shadow-md text-black">
                                             👑
                                          </span>
                                       )}
                                    </motion.div>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                     {winner && (
                        <button
                           onClick={() => setRoomData(null)}
                           className="mt-6 w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-bold transition-colors"
                        >
                           {t.common.backToMenu}
                        </button>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>
         </motion.div>
      </div>
   );
}
