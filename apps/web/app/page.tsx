"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSocket } from "../providers/SocketProvider";

export default function Home() {
   const { socket, user, dbUser, isConnected } = useSocket();
   const router = useRouter();

   const [showLeaderboard, setShowLeaderboard] = useState(false);
   const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

   const [hubLobby, setHubLobby] = useState<any>(null);
   const [showLobbyJoin, setShowLobbyJoin] = useState(false);
   const [lobbyJoinCode, setLobbyJoinCode] = useState("");
   const [lobbyError, setLobbyError] = useState<string | null>(null);

   const deepLinkChecked = useRef(false);

   // YENI: Kullanıcının Telegram'daki Adını ve Soyadını birleştiriyoruz
   const telegramFullName =
      `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
   const displayName = telegramFullName || user?.username || "Oyuncu";

   useEffect(() => {
      if (!socket || !isConnected) return;

      const checkDeepLink = async () => {
         if (deepLinkChecked.current) return;
         deepLinkChecked.current = true;

         if (typeof window !== "undefined") {
            const WebApp = (await import("@twa-dev/sdk")).default;
            const startParam = WebApp.initDataUnsafe?.start_param;
            if (startParam && startParam.startsWith("lobby_")) {
               // Username yerine displayName gönderiyoruz
               socket.emit("join_hub_lobby", {
                  lobbyId: startParam,
                  username: displayName,
               });
            }
         }
      };
      checkDeepLink();

      socket.on("leaderboard_data", (data) => setLeaderboardData(data));

      socket.on("hub_lobby_updated", (data) => {
         setHubLobby(data);
         setShowLobbyJoin(false);
         setLobbyError(null);
      });

      socket.on("hub_lobby_closed", () => {
         setHubLobby(null);
         setLobbyError("Lobi kurucusu ayrıldı.");
         setTimeout(() => setLobbyError(null), 3000);
      });

      socket.on("room_error", ({ message }) => {
         setLobbyError(message);
         setTimeout(() => setLobbyError(null), 3000);
      });

      socket.on("hub_game_launched", ({ gamePath, roomId }) => {
         router.push(`${gamePath}?room=${roomId}`);
      });

      return () => {
         socket.off("leaderboard_data");
         socket.off("hub_lobby_updated");
         socket.off("hub_lobby_closed");
         socket.off("room_error");
         socket.off("hub_game_launched");
      };
   }, [socket, isConnected, displayName, router]);

   const toggleLeaderboard = () => {
      if (!showLeaderboard && socket) socket.emit("get_leaderboard");
      setShowLeaderboard(!showLeaderboard);
   };

   // Lobi fonksiyonlarında displayName kullanıyoruz
   const handleCreateLobby = () =>
      socket?.emit("create_hub_lobby", { username: displayName });
   const handleJoinLobby = () => {
      if (lobbyJoinCode.trim())
         socket?.emit("join_hub_lobby", {
            lobbyId: lobbyJoinCode.trim(),
            username: displayName,
         });
   };
   const handleLeaveLobby = () => {
      if (hubLobby)
         socket?.emit("leave_hub_lobby", { lobbyId: hubLobby.lobbyId });
      setHubLobby(null);
   };

   const launchGame = (gameType: string) => {
      if (hubLobby)
         socket?.emit("launch_hub_game", {
            lobbyId: hubLobby.lobbyId,
            gameType,
         });
   };

   const shareLobbyToTelegram = async () => {
      if (!hubLobby) return;
      const shareUrl = `https://t.me/${process.env.NEXT_PUBLIC_TG_BOT}/${process.env.NEXT_PUBLIC_TG_APP}?startapp=${hubLobby.lobbyId}`;
      const text = `Seni Nexus Oyun Salonu lobime davet ediyorum! Gel birlikte oyun seçelim 🎮`;
      if (typeof window !== "undefined") {
         const WebApp = (await import("@twa-dev/sdk")).default;
         WebApp.openTelegramLink(
            `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
         );
      }
   };

   return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white font-sans overflow-hidden">
         <AnimatePresence>
            {lobbyError && (
               <motion.div
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: 10 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="absolute top-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium z-50"
               >
                  {lobbyError}
               </motion.div>
            )}
         </AnimatePresence>

         <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl font-bold mb-6 text-center"
         >
            Nexus Space Hub
         </motion.h1>

         <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 p-6 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-sm relative"
         >
            <AnimatePresence mode="wait">
               {!hubLobby ? (
                  <motion.div
                     key="main-menu"
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 20 }}
                  >
                     <div className="mb-6 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <h3 className="text-sm font-bold text-zinc-400 mb-3 text-center">
                           🎮 Arkadaşınla Oyna
                        </h3>
                        <div className="flex gap-2">
                           <button
                              onClick={handleCreateLobby}
                              disabled={!isConnected}
                              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold text-sm transition-colors"
                           >
                              Lobi Kur
                           </button>
                           <button
                              onClick={() => setShowLobbyJoin(!showLobbyJoin)}
                              disabled={!isConnected}
                              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg font-bold text-sm transition-colors border border-zinc-700"
                           >
                              Lobiye Katıl
                           </button>
                        </div>
                        {showLobbyJoin && (
                           <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="flex gap-2 mt-2"
                           >
                              <input
                                 type="text"
                                 placeholder="Kodu yapıştır (lobby_...)"
                                 value={lobbyJoinCode}
                                 onChange={(e) =>
                                    setLobbyJoinCode(e.target.value)
                                 }
                                 className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                              />
                              <button
                                 onClick={handleJoinLobby}
                                 className="bg-purple-600 hover:bg-purple-500 px-4 rounded-lg font-bold text-sm"
                              >
                                 Git
                              </button>
                           </motion.div>
                        )}
                     </div>

                     <div className="space-y-3">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                           Hızlı Giriş (Solo)
                        </h3>
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
                           </div>
                        </Link>
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
                           </div>
                        </Link>
                        <Link
                           href="/connect4"
                           className="block w-full p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group"
                        >
                           <div className="flex justify-between items-center">
                              <div>
                                 <h4 className="font-bold text-lg text-white group-hover:text-yellow-400 transition-colors">
                                    🟡🔴 Hedef 4
                                 </h4>
                                 <p className="text-xs text-zinc-400 mt-1">
                                    Stratejik Disk Atma
                                 </p>
                              </div>
                           </div>
                        </Link>
                     </div>
                  </motion.div>
               ) : (
                  <motion.div
                     key="hub-lobby"
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="flex flex-col text-center"
                  >
                     <h2 className="text-xl font-bold mb-2 text-purple-400">
                        Merkez Lobi
                     </h2>
                     <p className="text-xs text-zinc-500 mb-4 font-mono select-all bg-zinc-950 py-1 rounded border border-zinc-800">
                        {hubLobby.lobbyId}
                     </p>

                     <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-6 flex justify-around items-center">
                        <div className="flex flex-col items-center">
                           <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold mb-2">
                              P1
                           </div>
                           <span className="text-sm font-bold">
                              {hubLobby.players[0].username}
                           </span>
                        </div>
                        <span className="text-zinc-600 font-bold text-xl">
                           VS
                        </span>
                        <div className="flex flex-col items-center">
                           <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 ${hubLobby.players[1] ? "bg-blue-600" : "bg-zinc-800 border border-zinc-700 border-dashed animate-pulse"}`}
                           >
                              {hubLobby.players[1] ? "P2" : "?"}
                           </div>
                           <span className="text-sm font-bold text-zinc-400">
                              {hubLobby.players[1]
                                 ? hubLobby.players[1].username
                                 : "Bekleniyor..."}
                           </span>
                        </div>
                     </div>

                     {hubLobby.players.length === 1 && (
                        <button
                           onClick={shareLobbyToTelegram}
                           className="w-full py-3 mb-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors"
                        >
                           Arkadaşını Davet Et (Telegram)
                        </button>
                     )}

                     {hubLobby.players.length === 2 && (
                        <div className="mb-4">
                           {hubLobby.players[0].socketId === socket?.id ? (
                              <div className="space-y-2">
                                 <h3 className="text-sm font-bold text-zinc-300 mb-3">
                                    Bir Oyun Seç:
                                 </h3>
                                 <button
                                    onClick={() => launchGame("RPS")}
                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg font-bold text-sm"
                                 >
                                    ✊✋✌️ Taş-Kağıt-Makas
                                 </button>
                                 <button
                                    onClick={() => launchGame("CHECKERS")}
                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg font-bold text-sm"
                                 >
                                    🏁 Dama
                                 </button>
                                 <button
                                    onClick={() => launchGame("CONNECT4")}
                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg font-bold text-sm"
                                 >
                                    🟡🔴 Hedef 4
                                 </button>
                              </div>
                           ) : (
                              <div className="py-6 border border-zinc-800 border-dashed rounded-lg">
                                 <p className="text-sm text-zinc-400 animate-pulse">
                                    Kurucu oyun seçiyor...
                                 </p>
                              </div>
                           )}
                        </div>
                     )}

                     <button
                        onClick={handleLeaveLobby}
                        className="text-xs text-red-500 hover:text-red-400 underline mt-2"
                     >
                        Lobiden Ayrıl
                     </button>
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
