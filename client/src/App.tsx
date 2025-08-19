import EventGeneration from "./components/EventGeneration";
import GameLoadingPage from "./components/GameLoadingPage";
import IdeaPickerInRoom from "./components/room/IdeaPickerInRoom";
import GamePlay from "./components/gameplay/GamePlay";
import GameResult from "./components/GameResult";
import { InitialPage } from "./components/InitialPage";
import RoleSelection from "./components/roleSelection/RoleSelection";
import RoomEntrance from "./components/room/RoomEntrance";
import RoundLoadingPage from "./components/RoundLoadingPage";
import UserNamePage from "./components/UsernamePage";
import { GAME_UX_PAGEING } from "./const/const";
import { useGame } from "./context/GameContext";
import { RoomLobby } from "./components/room/RoomLobby";

function App() {
  const { room, gameState } = useGame();

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
    switch (gameState.gameState) {
      case GAME_UX_PAGEING.IDEA_INPUT:
        return <IdeaPickerInRoom />;
      case GAME_UX_PAGEING.ROLE_SELECTION:
        return <RoleSelection />;
      case GAME_UX_PAGEING.LOADING:
        return <GameLoadingPage />;
      case GAME_UX_PAGEING.ROUND_LOADING:
        return <RoundLoadingPage />;
      case GAME_UX_PAGEING.EVENT_GENERATION:
        return <EventGeneration />;
      case GAME_UX_PAGEING.PLAYING:
        return <GamePlay />;
      case GAME_UX_PAGEING.ROUND_RESULT:
        return null;
      case GAME_UX_PAGEING.RESULT:
        return <GameResult />;
      default:
        return <UserNamePage />;
    }
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
