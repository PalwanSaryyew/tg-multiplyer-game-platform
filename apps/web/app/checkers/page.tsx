"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSocket } from "../../providers/SocketProvider";

export default function CheckersGame() {
   const { socket, isConnected } = useSocket();
   const [isSearching, setIsSearching] = useState(false);
   const [roomData, setRoomData] = useState<any>(null);

   const [board, setBoard] = useState<number[]>([]);
   const [turn, setTurn] = useState<string>("");
   const [myColor, setMyColor] = useState<"RED" | "WHITE" | null>(null);
   const [selectedCell, setSelectedCell] = useState<number | null>(null);
   const [winner, setWinner] = useState<string | null>(null);
   const [moveError, setMoveError] = useState<string | null>(null);

   useEffect(() => {
      if (!socket) return;

      socket.on("checkers_waiting_in_queue", () => setIsSearching(true));

      socket.on("checkers_match_found", (data) => {
         setIsSearching(false);
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

         // YENİ: Eğer seri yeme devam ediyorsa, o taşı otomatik seç!
         if (
            data.multiJumpIndex !== undefined &&
            data.multiJumpIndex !== null
         ) {
            setSelectedCell(data.multiJumpIndex);
         } else {
            setSelectedCell(null);
         }
      });

      socket.on("checkers_game_over", (data) => {
         setBoard(data.board);
         setWinner(data.winner);
         setSelectedCell(null);
      });

      socket.on("checkers_invalid_move", (data) => {
         if (data?.reason === "MUST_CAPTURE") {
            setSelectedCell(null);
            setMoveError(
               "Yiyebileceğin bir taş varken başka hamle yapamazsın!",
            );
         } else if (data?.reason === "MUST_CONTINUE_JUMP") {
            setMoveError(
               "Seri yeme devam ediyor! Aynı taşla yemeye devam etmelisin.",
            );
         } else {
            setSelectedCell(null);
         }
         setTimeout(() => setMoveError(null), 3000);
      });

      return () => {
         socket.off("checkers_waiting_in_queue");
         socket.off("checkers_match_found");
         socket.off("checkers_board_updated");
         socket.off("checkers_game_over");
         socket.off("checkers_invalid_move");
      };
   }, [socket]);

   const handleFindMatch = () => {
      socket?.emit("checkers_find_match");
   };

   const handleCellClick = (index: number) => {
      if (!socket || !roomData || winner || turn !== socket.id) return;

      // YENİ: Seri yeme zorunluluğu varsa BAŞKA TAŞ seçmesini tamamen engelle
      if (
         roomData.multiJumpIndex !== null &&
         roomData.multiJumpIndex !== undefined
      ) {
         // Eğer tıklanan yer boş kare değilse ve kilitli taşımız değilse engelle
         if (board[index] !== 0 && index !== roomData.multiJumpIndex) {
            setMoveError(
               "Seri yeme devam ediyor! Sadece işaretli taşı oynayabilirsin.",
            );
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
               ⬅ Ana Menü
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
               🏁 1v1 Dama
            </h2>

            <AnimatePresence mode="wait">
               {!roomData ? (
                  <motion.button
                     key="find"
                     onClick={handleFindMatch}
                     disabled={isSearching || !isConnected}
                     className={`w-full py-3 rounded-lg font-bold transition-colors ${isSearching ? "bg-blue-600 animate-pulse text-white" : !isConnected ? "bg-zinc-700 text-zinc-500" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
                  >
                     {isSearching ? "Rakip Aranıyor..." : "🎲 Dama Maçı Ara"}
                  </motion.button>
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
                        <span className="text-zinc-600">vs</span>
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
                              ? "🎉 Kazandın!"
                              : "💀 Kaybettin!"
                           : turn === socket?.id
                             ? "🟢 Senin Sıran!"
                             : "⏳ Rakibin Sırası..."}
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
                                 className={`w-full h-full flex items-center justify-center relative aspect-square transition-all ${
                                    isDarkSquare
                                       ? "bg-zinc-800 cursor-pointer hover:bg-zinc-700/50"
                                       : "bg-zinc-200"
                                 } ${selectedCell === actualIndex ? "ring-4 ring-purple-500 ring-inset bg-zinc-700" : ""}`}
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
                           Menüye Dön
                        </button>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>
         </motion.div>
      </div>
   );
}
