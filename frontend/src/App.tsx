import { BrowserRouter } from "react-router-dom";

import { AppRoutes } from "./routes";
import { AuthSessionProvider } from "./stores";

function App() {
  return (
    <AuthSessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthSessionProvider>
  );
}

export default App;
