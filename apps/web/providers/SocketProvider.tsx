"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
   socket: Socket | null;
   user: any | null;
   dbUser: any | null;
   isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
   socket: null,
   user: null,
   dbUser: null,
   isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
   const [socket, setSocket] = useState<Socket | null>(null);
   const [user, setUser] = useState<any>(null);
   const [dbUser, setDbUser] = useState<any>(null);
   const [isConnected, setIsConnected] = useState(false);

   useEffect(() => {
      let currentSocket: Socket;

      const initTelegramAndSocket = async () => {
         let localUser: any = null;
         if (typeof window !== "undefined") {
            const WebApp = (await import("@twa-dev/sdk")).default;
            if (WebApp.initDataUnsafe?.user) {
               localUser = WebApp.initDataUnsafe.user;
               setUser(localUser);
               WebApp.ready();
            }
         }

         currentSocket = io("http://localhost:3001");
         setSocket(currentSocket);

         currentSocket.on("connect", () => {
            setIsConnected(true);
            if (localUser) {
               currentSocket.emit("register_player", {
                  telegramId: localUser.id,
                  username: localUser.first_name,
               });
            }
         });

         currentSocket.on("player_registered", (playerData) =>
            setDbUser(playerData),
         );

         currentSocket.on("disconnect", () => {
            setIsConnected(false);
         });
      };

      initTelegramAndSocket();
      return () => {
         if (currentSocket) currentSocket.disconnect();
      };
   }, []);

   return (
      <SocketContext.Provider value={{ socket, user, dbUser, isConnected }}>
         {children}
      </SocketContext.Provider>
   );
};
