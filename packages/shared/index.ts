export type Player = {
   id: string;
   telegramId: number;
   username: string;
};

export type GameMove = {
   gameId: string;
   playerId: string;
   move: "ROCK" | "PAPER" | "SCISSORS";
};
