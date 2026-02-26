import { BrowserRouter } from "react-router-dom";

import { AppRoutes } from "./routes";
import { AuthSessionProvider, ThemeProvider } from "./stores";

function App() {
  return (
    <ThemeProvider>
      <AuthSessionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthSessionProvider>
    </ThemeProvider>
  );
}

export default App;
