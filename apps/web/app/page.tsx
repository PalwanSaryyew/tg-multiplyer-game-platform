"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSocket } from "../providers/SocketProvider";

export default function Home() {
   const { socket, user, dbUser, isConnected } = useSocket();
   const [showLeaderboard, setShowLeaderboard] = useState(false);
   const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

   useEffect(() => {
      if (!socket) return;
      socket.on("leaderboard_data", (data) => setLeaderboardData(data));
      return () => {
         socket.off("leaderboard_data");
      };
   }, [socket]);

   const toggleLeaderboard = () => {
      if (!showLeaderboard && socket) socket.emit("get_leaderboard");
      setShowLeaderboard(!showLeaderboard);
   };

   return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white font-sans overflow-hidden">
         <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl font-bold mb-6"
         >
            Nexus Space Hub
         </motion.h1>

         <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 p-6 rounded-xl shadow-lg border border-zinc-800 w-full max-w-sm relative"
         >
            <div className="flex justify-between items-start mb-4">
               <h2 className="text-xl font-semibold">Profil</h2>
               <button
                  onClick={toggleLeaderboard}
                  className="text-xl hover:scale-110 transition-transform"
               >
                  🏆
               </button>
            </div>

            {user ? (
               <div className="mb-6">
                  <p className="text-zinc-400">
                     Hoş geldin,{" "}
                     <span className="text-blue-400 font-medium">
                        {user.first_name}
                     </span>
                     !
                  </p>
                  {dbUser && (
                     <p className="text-xs text-zinc-500 mt-1">
                        🏆 Galibiyet:{" "}
                        <span className="text-green-400 font-bold">
                           {dbUser.wins}
                        </span>{" "}
                        | Mağlubiyet:{" "}
                        <span className="text-red-400 font-bold">
                           {dbUser.losses}
                        </span>
                     </p>
                  )}
               </div>
            ) : (
               <p className="text-zinc-500 italic mb-6">
                  Telegram dışından girildi.
               </p>
            )}

            <AnimatePresence mode="wait">
               {showLeaderboard ? (
                  <motion.div
                     key="leaderboard"
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="flex flex-col"
                  >
                     <h3 className="text-yellow-400 font-bold mb-3 text-center border-b border-zinc-800 pb-2">
                        En İyi 10 Oyuncu
                     </h3>
                     <div className="flex-1 overflow-y-auto max-h-[200px] pr-2 space-y-2 mb-4">
                        {leaderboardData.length === 0 ? (
                           <p className="text-center text-zinc-500 text-sm mt-4">
                              Henüz kimse kazanmadı.
                           </p>
                        ) : (
                           leaderboardData.map((p, index) => (
                              <div
                                 key={index}
                                 className="flex justify-between items-center bg-zinc-800 p-2 rounded-lg text-sm"
                              >
                                 <div className="flex items-center gap-2">
                                    <span className="w-5 text-center font-bold text-zinc-500">
                                       {index === 0
                                          ? "🥇"
                                          : index === 1
                                            ? "🥈"
                                            : index === 2
                                              ? "🥉"
                                              : `${index + 1}.`}
                                    </span>
                                    <span className="text-white font-medium truncate max-w-[120px]">
                                       {p.username}
                                    </span>
                                 </div>
                                 <span className="text-green-400 font-bold">
                                    {p.wins} W
                                 </span>
                              </div>
                           ))
                        )}
                     </div>
                     <button
                        onClick={toggleLeaderboard}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors"
                     >
                        Geri Dön
                     </button>
                  </motion.div>
               ) : (
                  <motion.div
                     key="games"
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 20 }}
                     className="space-y-4"
                  >
                     <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        Oyunlar
                     </h3>

                     {/* Aktif Oyun: Taş Kağıt Makas */}
                     <Link
                        href="/rps"
                        className="block w-full p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group"
                     >
                        <div className="flex justify-between items-center">
                           <div>
                              <h4 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                                 ✊✋✌️ T.K.M.
                              </h4>
                              <p className="text-xs text-zinc-400 mt-1">
                                 Klasik 1v1 Düello
                              </p>
                           </div>
                           <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full font-bold">
                              Aktif
                           </span>
                        </div>
                     </Link>

                     {/* Yakında: Dama */}
                     {/* Dama Oyunu - ARTIK AKTİF */}
                     <Link
                        href="/checkers"
                        className="block w-full p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group"
                     >
                        <div className="flex justify-between items-center">
                           <div>
                              <h4 className="font-bold text-lg text-white group-hover:text-purple-400 transition-colors">
                                 🏁 Dama (Checkers)
                              </h4>
                              <p className="text-xs text-zinc-400 mt-1">
                                 Sıra Tabanlı Strateji
                              </p>
                           </div>
                           <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded-full font-bold">
                              Aktif
                           </span>
                        </div>
                     </Link>
                  </motion.div>
               )}
            </AnimatePresence>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
               <span className="text-sm text-zinc-400">Durum:</span>
               <span
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isConnected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
               >
                  {isConnected ? "Bağlı 🟢" : "Bekleniyor 🔴"}
               </span>
            </div>
         </motion.div>
      </div>
   );
}
