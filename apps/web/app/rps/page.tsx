"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSocket } from "../../providers/SocketProvider";

export default function RPSGame() {
   const { socket, user, isConnected } = useSocket();
   const [isSearching, setIsSearching] = useState(false);
   const [roomData, setRoomData] = useState<any>(null);

   const [inviteCode, setInviteCode] = useState<string | null>(null);
   const [showJoinInput, setShowJoinInput] = useState(false);
   const [joinCodeInput, setJoinCodeInput] = useState("");
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   const [myMove, setMyMove] = useState<string | null>(null);
   const [opponentPlayed, setOpponentPlayed] = useState(false);
   const [result, setResult] = useState<any>(null);

   useEffect(() => {
      if (!socket) return;

      // Deep link kontrolü (Davet linkiyle geldiyse)
      const checkDeepLink = async () => {
         if (typeof window !== "undefined") {
            const WebApp = (await import("@twa-dev/sdk")).default;
            const startParam = WebApp.initDataUnsafe?.start_param;
            if (startParam && startParam.startsWith("pvp_")) {
               socket.emit("join_private_room", { roomId: startParam });
            }
         }
      };
      checkDeepLink();

      socket.on("waiting_in_queue", () => setIsSearching(true));
      socket.on("private_room_created", ({ roomId }) => setInviteCode(roomId));

      socket.on("room_error", ({ message }) => {
         setErrorMessage(message);
         setTimeout(() => setErrorMessage(null), 3000);
      });

      socket.on("match_found", (data) => {
         setIsSearching(false);
         setInviteCode(null);
         setShowJoinInput(false);
         setRoomData(data);
         setMyMove(null);
         setOpponentPlayed(false);
         setResult(null);
      });

      socket.on("opponent_played", () => setOpponentPlayed(true));
      socket.on("game_result", (data) => setResult(data));

      // Ekrandan çıkarsa state'leri temizle dinleyicileri kaldır
      return () => {
         socket.off("waiting_in_queue");
         socket.off("private_room_created");
         socket.off("room_error");
         socket.off("match_found");
         socket.off("opponent_played");
         socket.off("game_result");
      };
   }, [socket]);

   const handleFindMatch = () => {
      socket?.emit("find_match");
   };
   const handleCreatePrivateRoom = () => {
      socket?.emit("create_private_room");
   };
   const handleJoinPrivateRoom = () => {
      if (!joinCodeInput.trim()) return;
      socket?.emit("join_private_room", { roomId: joinCodeInput.trim() });
   };

   const playMove = (move: string) => {
      if (!socket || !roomData || myMove) return;
      setMyMove(move);
      socket.emit("play_move", { roomId: roomData.roomId, move });
   };

   const shareToTelegram = async () => {
      if (!inviteCode) return;
      const shareUrl = `https://t.me/${process.env.NEXT_PUBLIC_TG_BOT}/${process.env.NEXT_PUBLIC_TG_APP}?startapp=${inviteCode}`;
      const text = `Seni Taş-Kağıt-Makas düellosuna davet ediyorum! Gel kapışalım ⚔️`;
      if (typeof window !== "undefined") {
         const WebApp = (await import("@twa-dev/sdk")).default;
         WebApp.openTelegramLink(
            `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
         );
      }
   };

   const getResultMessage = () => {
      if (!result || !socket) return null;
      if (result.winner === "DRAW") return "Berabere! 🤝";
      return result.winner === socket.id ? "Kazandın! 🎉" : "Kaybettin! 💀";
   };

   return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white font-sans overflow-hidden">
         <AnimatePresence>
            {errorMessage && (
               <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 10 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="absolute top-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium z-50"
               >
                  {errorMessage}
               </motion.div>
            )}
         </AnimatePresence>

         {/* Geri Dön Butonu */}
         <div className="absolute top-4 left-4">
            <Link
               href="/"
               className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors"
            >
               ⬅ Ana Menü
            </Link>
         </div>

         <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 p-6 rounded-xl shadow-lg border border-zinc-800 w-full max-w-sm relative mt-12"
         >
            <h2 className="text-xl font-bold mb-6 text-center border-b border-zinc-800 pb-4">
               Taş-Kağıt-Makas
            </h2>

            <div className="min-h-[220px] flex flex-col justify-center">
               <AnimatePresence mode="wait">
                  {!roomData ? (
                     !inviteCode ? (
                        <motion.div
                           key="lobby-menu"
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: 20 }}
                           className="flex flex-col gap-3"
                        >
                           <button
                              onClick={handleFindMatch}
                              disabled={isSearching || !isConnected}
                              className={`w-full py-3 rounded-lg font-bold transition-colors ${isSearching ? "bg-blue-600 animate-pulse text-white" : !isConnected ? "bg-zinc-700 text-zinc-500" : "bg-green-600 hover:bg-green-500 text-white"}`}
                           >
                              {isSearching
                                 ? "Rakip Aranıyor..."
                                 : "🎲 Rastgele Eşleşme (1v1)"}
                           </button>

                           {!isSearching && (
                              <div className="flex gap-2">
                                 <button
                                    onClick={handleCreatePrivateRoom}
                                    disabled={!isConnected}
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-colors"
                                 >
                                    ⚔️ Düello Kur
                                 </button>
                                 <button
                                    onClick={() =>
                                       setShowJoinInput(!showJoinInput)
                                    }
                                    disabled={!isConnected}
                                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-lg font-bold transition-colors"
                                 >
                                    Katıl
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
                                    placeholder="Oda Kodu (pvp_...)"
                                    value={joinCodeInput}
                                    onChange={(e) =>
                                       setJoinCodeInput(e.target.value)
                                    }
                                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                 />
                                 <button
                                    onClick={handleJoinPrivateRoom}
                                    className="bg-purple-600 hover:bg-purple-500 px-4 rounded-lg font-bold"
                                 >
                                    Git
                                 </button>
                              </motion.div>
                           )}
                        </motion.div>
                     ) : (
                        <motion.div
                           key="invite-screen"
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="text-center bg-zinc-800 p-4 rounded-lg border border-purple-500/50"
                        >
                           <h3 className="text-purple-400 font-bold mb-2">
                              ⚔️ Odan Hazır!
                           </h3>
                           <p className="text-sm text-zinc-400 mb-4">
                              Arkadaşını davet et veya kodu gönder.
                           </p>
                           <div className="bg-zinc-950 p-3 rounded-lg mb-4 select-all font-mono text-sm border border-zinc-700">
                              {inviteCode}
                           </div>
                           <div className="flex gap-2">
                              <button
                                 onClick={shareToTelegram}
                                 className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold text-sm"
                              >
                                 Telegram'da Paylaş
                              </button>
                              <button
                                 onClick={() => setInviteCode(null)}
                                 className="px-4 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold text-sm"
                              >
                                 İptal
                              </button>
                           </div>
                        </motion.div>
                     )
                  ) : (
                     <motion.div
                        key="game-room"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 bg-zinc-800 border border-green-500/50 rounded-lg text-center"
                     >
                        <div className="flex items-center justify-center space-x-2 text-sm font-medium mb-4 pb-4 border-b border-zinc-700">
                           <span className="text-blue-400">
                              {roomData.players[0].username}
                           </span>
                           <span className="text-zinc-500">vs</span>
                           <span className="text-red-400">
                              {roomData.players[1].username}
                           </span>
                        </div>

                        <AnimatePresence mode="wait">
                           {!result ? (
                              <motion.div
                                 key="playing-phase"
                                 initial={{ opacity: 0, x: 20 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 exit={{ opacity: 0, x: -20 }}
                              >
                                 <p className="text-zinc-300 mb-4">
                                    Seçimini yap:
                                 </p>
                                 <div className="flex justify-center gap-6">
                                    {["ROCK", "PAPER", "SCISSORS"].map(
                                       (move) => (
                                          <motion.button
                                             key={move}
                                             whileHover={
                                                !myMove ? { scale: 1.2 } : {}
                                             }
                                             whileTap={
                                                !myMove ? { scale: 0.9 } : {}
                                             }
                                             onClick={() => playMove(move)}
                                             disabled={!!myMove}
                                             className={`text-4xl transition-opacity ${myMove && myMove !== move ? "opacity-30 grayscale" : "opacity-100"}`}
                                          >
                                             {move === "ROCK"
                                                ? "✊"
                                                : move === "PAPER"
                                                  ? "✋"
                                                  : "✌️"}
                                          </motion.button>
                                       ),
                                    )}
                                 </div>
                                 <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="mt-6 text-sm h-6 text-zinc-400"
                                 >
                                    {myMove &&
                                       !opponentPlayed &&
                                       "Rakip bekleniyor..."}
                                    {!myMove &&
                                       opponentPlayed &&
                                       "Rakip seçimini yaptı!"}
                                    {myMove &&
                                       opponentPlayed &&
                                       "Hesaplanıyor..."}
                                 </motion.div>
                              </motion.div>
                           ) : (
                              <motion.div
                                 key="result-phase"
                                 initial={{ opacity: 0, scale: 0.5, y: 20 }}
                                 animate={{ opacity: 1, scale: 1, y: 0 }}
                                 transition={{ type: "spring", damping: 15 }}
                              >
                                 <h3
                                    className={`text-3xl font-bold mb-4 ${result.winner === socket?.id ? "text-green-400" : result.winner === "DRAW" ? "text-yellow-400" : "text-red-400"}`}
                                 >
                                    {getResultMessage()}
                                 </h3>
                                 <div className="flex justify-center items-center gap-8 text-zinc-400 text-sm mb-6 bg-zinc-900/50 p-3 rounded-lg">
                                    <div className="flex flex-col items-center">
                                       <span className="mb-1">Sen</span>
                                       <span className="text-3xl">
                                          {result.moves[socket?.id || ""] ===
                                          "ROCK"
                                             ? "✊"
                                             : result.moves[
                                                    socket?.id || ""
                                                 ] === "PAPER"
                                               ? "✋"
                                               : "✌️"}
                                       </span>
                                    </div>
                                    <div className="text-lg font-bold">VS</div>
                                    <div className="flex flex-col items-center">
                                       <span className="mb-1">Rakip</span>
                                       <span className="text-3xl">
                                          {Object.entries(result.moves).find(
                                             ([id]) => id !== socket?.id,
                                          )?.[1] === "ROCK"
                                             ? "✊"
                                             : Object.entries(
                                                    result.moves,
                                                 ).find(
                                                    ([id]) => id !== socket?.id,
                                                 )?.[1] === "PAPER"
                                               ? "✋"
                                               : "✌️"}
                                       </span>
                                    </div>
                                 </div>
                                 <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                       setRoomData(null);
                                       setResult(null);
                                       setMyMove(null);
                                    }}
                                    className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white font-bold transition-colors shadow-lg"
                                 >
                                    Odadan Çık
                                 </motion.button>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>
         </motion.div>
      </div>
   );
}
