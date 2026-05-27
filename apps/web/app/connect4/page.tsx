"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSocket } from "../../providers/SocketProvider";
import { useLanguage } from "../../providers/LanguageProvider"; // YENİ

export default function Connect4() {
   const { t } = useLanguage(); // YENİ
   const { socket, isConnected } = useSocket();
   const [room, setRoom] = useState<any>(null);
   const [isSearching, setIsSearching] = useState(false);
   const [board, setBoard] = useState<number[]>([]);
   const [turn, setTurn] = useState("");
   const [myColor, setMyColor] = useState("");
   const [winner, setWinner] = useState<string | null>(null);

   const [inviteCode, setInviteCode] = useState<string | null>(null);
   const [showJoinInput, setShowJoinInput] = useState(false);
   const [joinCodeInput, setJoinCodeInput] = useState("");
   const [moveError, setMoveError] = useState<string | null>(null);

   useEffect(() => {
      if (!socket) return;
      const checkLinks = async () => {
         const urlParams = new URLSearchParams(window.location.search);
         const roomQuery = urlParams.get("room");

         if (roomQuery) {
            socket.emit("c4_join_private_room", { roomId: roomQuery });
         } else if (typeof window !== "undefined") {
            const WebApp = (await import("@twa-dev/sdk")).default;
            const startParam = WebApp.initDataUnsafe?.start_param;
            if (startParam && startParam.startsWith("c4pvp_")) {
               socket.emit("c4_join_private_room", { roomId: startParam });
            }
         }
      };
      checkLinks();

      socket.on("c4_waiting", () => setIsSearching(true));
      socket.on("c4_private_room_created", ({ roomId }) =>
         setInviteCode(roomId),
      );
      socket.on("room_error", ({ message }) => {
         setMoveError(message);
         setTimeout(() => setMoveError(null), 3000);
      });

      socket.on("c4_match_found", (data) => {
         setIsSearching(false);
         setInviteCode(null);
         setShowJoinInput(false);
         setRoom(data);
         setBoard(data.board);
         setTurn(data.turn);
         setWinner(null);
         const me = data.players.find((p: any) => p.id === socket.id);
         if (me) setMyColor(me.color);
      });

      socket.on("c4_updated", (data) => {
         setBoard(data.board);
         setTurn(data.turn);
      });
      socket.on("c4_game_over", (data) => {
         setBoard(data.board);
         setWinner(data.winnerId);
      });

      return () => {
         socket.off("c4_waiting");
         socket.off("c4_private_room_created");
         socket.off("room_error");
         socket.off("c4_match_found");
         socket.off("c4_updated");
         socket.off("c4_game_over");
      };
   }, [socket]);

   const handleFindMatch = () => socket?.emit("c4_find_match");
   const handleCreatePrivateRoom = () => socket?.emit("c4_create_private_room");
   const handleJoinPrivateRoom = () => {
      if (joinCodeInput.trim())
         socket?.emit("c4_join_private_room", { roomId: joinCodeInput.trim() });
   };

   const shareToTelegram = async () => {
      if (!inviteCode) return;
      const shareUrl = `https://t.me/${process.env.NEXT_PUBLIC_TG_BOT}/${process.env.NEXT_PUBLIC_TG_APP}?startapp=${inviteCode}`;
      const text = t.connect4.shareText;
      if (typeof window !== "undefined") {
         const WebApp = (await import("@twa-dev/sdk")).default;
         WebApp.openTelegramLink(
            `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
         );
      }
   };

   const dropPiece = (col: number) => {
      if (turn === socket?.id && !winner)
         socket?.emit("c4_make_move", { roomId: room.roomId, col });
   };

   return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4">
         <Link
            href="/"
            className="absolute top-4 left-4 bg-zinc-800 px-4 py-2 rounded-lg text-sm font-bold"
         >
            {t.common.mainMenu}
         </Link>

         <AnimatePresence>
            {moveError && (
               <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 10 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="absolute top-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg font-bold z-50 text-center text-sm"
               >
                  ⚠️ {moveError}
               </motion.div>
            )}
         </AnimatePresence>

         <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 w-full max-w-sm mt-8"
         >
            <h2 className="text-xl font-bold mb-4 text-center">
               {t.games.connect4Title}
            </h2>

            <AnimatePresence mode="wait">
               {!room ? (
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
                           <div className="flex gap-2">
                              <button
                                 onClick={handleCreatePrivateRoom}
                                 disabled={!isConnected}
                                 className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold transition-colors"
                              >
                                 {t.common.createDuel}
                              </button>
                              <button
                                 onClick={() =>
                                    setShowJoinInput(!showJoinInput)
                                 }
                                 disabled={!isConnected}
                                 className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg font-bold transition-colors"
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
                                 placeholder={t.connect4.roomCodePlaceholder}
                                 value={joinCodeInput}
                                 onChange={(e) =>
                                    setJoinCodeInput(e.target.value)
                                 }
                                 className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                              />
                              <button
                                 onClick={handleJoinPrivateRoom}
                                 className="bg-yellow-600 hover:bg-yellow-500 px-4 rounded-lg font-bold"
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
                        className="text-center bg-zinc-800 p-4 rounded-lg border border-yellow-500/50"
                     >
                        <h3 className="text-yellow-400 font-bold mb-2">
                           {t.common.roomReady}
                        </h3>
                        <p className="text-sm text-zinc-400 mb-4">
                           {t.common.inviteFriendDesc}
                        </p>
                        <div className="bg-zinc-950 p-3 rounded-lg mb-4 select-all font-mono text-sm border border-zinc-700">
                           {inviteCode}
                        </div>
                        <div className="flex gap-2">
                           <button
                              onClick={shareToTelegram}
                              className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold text-sm"
                           >
                              {t.common.shareTelegram}
                           </button>
                           <button
                              onClick={() => setInviteCode(null)}
                              className="px-4 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold text-sm"
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
                     <div className="flex justify-between w-full mb-4 px-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
                        <span
                           className={
                              myColor === "YELLOW" ? "text-yellow-400" : ""
                           }
                        >
                           {t.connect4.yellow}: {room.players[0].name}
                        </span>
                        <span
                           className={myColor === "RED" ? "text-red-400" : ""}
                        >
                           {t.connect4.red}: {room.players[1].name}
                        </span>
                     </div>
                     <p className="mb-4 font-bold">
                        {winner
                           ? winner === "DRAW"
                              ? t.common.draw
                              : winner === socket?.id
                                ? t.common.youWin
                                : t.common.youLose
                           : turn === socket?.id
                             ? t.common.yourTurn
                             : t.common.opponentsTurn}
                     </p>
                     <div className="bg-blue-700 p-2 rounded-xl shadow-2xl grid grid-cols-7 gap-2 relative border-4 border-blue-800">
                        {Array.from({ length: 7 }).map((_, colIndex) => (
                           <div
                              key={colIndex}
                              onClick={() => dropPiece(colIndex)}
                              className="flex flex-col gap-2 cursor-pointer group"
                           >
                              {Array.from({ length: 6 }).map((_, rowIndex) => {
                                 const idx = rowIndex * 7 + colIndex;
                                 const piece = board[idx];
                                 return (
                                    <div
                                       key={rowIndex}
                                       className="w-10 h-10 rounded-full bg-zinc-950/50 border-2 border-blue-900 flex items-center justify-center overflow-hidden"
                                    >
                                       <AnimatePresence>
                                          {piece !== 0 && (
                                             <motion.div
                                                initial={{ y: -300 }}
                                                animate={{ y: 0 }}
                                                transition={{
                                                   type: "spring",
                                                   stiffness: 120,
                                                   damping: 12,
                                                }}
                                                className={`w-full h-full rounded-full shadow-inner ${piece === 1 ? "bg-yellow-400" : "bg-red-500"}`}
                                             />
                                          )}
                                       </AnimatePresence>
                                       {turn === socket?.id && piece === 0 && (
                                          <div
                                             className={`w-full h-full opacity-0 group-hover:opacity-20 rounded-full ${myColor === "YELLOW" ? "bg-yellow-400" : "bg-red-500"}`}
                                          />
                                       )}
                                    </div>
                                 );
                              })}
                           </div>
                        ))}
                     </div>
                     {winner && (
                        <button
                           onClick={() => setRoom(null)}
                           className="mt-6 w-full py-2 bg-zinc-800 rounded-lg"
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
