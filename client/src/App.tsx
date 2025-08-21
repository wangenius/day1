import GameLoadingPage from "./components/GameLoadingPage";
import GamePlay from "./components/gameplay/GamePlay";
import GameResult from "./components/GameResult";
import { InitialPage } from "./components/InitialPage";
import RoleSelection from "./components/roleSelection/RoleSelection";
import IdeaPickerInRoom from "./components/room/IdeaPickerInRoom";
import RoomEntrance from "./components/room/RoomEntrance";
import { RoomLobby } from "./components/room/RoomLobby";
import RoundLoadingPage from "./components/RoundLoadingPage";
import UserNamePage from "./components/UsernamePage";
import { useGameState } from "./context/StateContext";

function App() {
  const { room, game } = useGameState();

  const renderCurrentState = () => {
    switch (room.roomState) {
      case "landing_page":
        return <InitialPage />;
      case "username":
        return <UserNamePage />;
      case "entrance":
        return <RoomEntrance />;
      case "waiting":
        return <RoomLobby />;
    }
    if (game.state.state === "playing") {
      if (Object.keys(game.state.ideas).length < room.state.players.length) {
        return <IdeaPickerInRoom />;
      }
      if (Object.keys(game.state.roles).length < room.state.players.length) {
        return <RoleSelection />;
      }
      if (game.state.background === "") {
        return <GameLoadingPage />;
      }
      // 检查是否所有玩家都已提交
      const currentRound = game.state.rounds[game.state.current_round];
      const allPlayersSubmitted = currentRound && 
        Object.keys(currentRound.player_actions || {}).length === room.state.players.length;
      
      if (
        game.state.rounds[game.state.current_round] === undefined ||
        game.state.rounds[game.state.current_round].phase_remain === 0 ||
        !game.state.rounds[game.state.current_round].situation ||
        Object.keys(game.state.rounds[game.state.current_round].decision_options || {}).length === 0 ||
        allPlayersSubmitted
      ) {
        return <RoundLoadingPage />;
      }
      return <GamePlay />;
    }
    return <GameResult />;
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      <div className="flex-1 w-full max-w-md mx-auto">
        {renderCurrentState()}
      </div>
    </div>
  );
}

export default App;
